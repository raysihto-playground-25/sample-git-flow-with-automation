import * as core from '@actions/core';

import type {
  ActionConfig,
  ActionResult,
  CheckResult,
  EventContext,
  MergeOptions,
  PullRequestData,
} from '../../common/types.js';
import {
  buildCheckResultsMarkdown,
  determineMergeMethod,
  getMergeableStateDescription,
  hasValidAuthorAssociation,
  hasValidPermission,
  isBot,
  isConventionalCommitTitle,
  parseCommand,
  validatePRState,
  waitBeforeRetryMs,
} from '../../common/utils.js';
import type { GitHubRepository } from './merge.repository.js';
import { MergeCommitService } from './merge.service.js';

/**
 * Main action orchestrator for the merge operation.
 * Contains pure business logic with dependencies injected.
 */
export class MergeAction {
  private readonly commitService: MergeCommitService;

  constructor(private readonly repository: GitHubRepository) {
    this.commitService = new MergeCommitService();
  }

  async execute(context: EventContext, config: ActionConfig): Promise<ActionResult> {
    const {
      owner,
      repo,
      prNumber,
      commentId,
      commentBody,
      actor,
      userType,
      authorAssociation,
      eventName,
      isPullRequest,
    } = context;

    // Early validation checks
    if (eventName !== 'issue_comment') {
      return { status: 'skipped', message: 'This action only runs on issue_comment events' };
    }

    if (!isPullRequest) {
      return { status: 'skipped', message: 'Comment is not on a PR, skipping' };
    }

    if (isBot(userType)) {
      return { status: 'skipped', message: 'Comment is from a bot' };
    }

    const mergeOptions = parseCommand(commentBody);
    if (!mergeOptions) {
      return { status: 'skipped', message: 'Command not matched' };
    }

    await this.repository.addReaction(owner, repo, commentId, 'eyes');

    // Permission checks
    if (!hasValidAuthorAssociation(authorAssociation)) {
      await this.repository.postComment(
        owner,
        repo,
        prNumber,
        `## Permission denied\n\n> [!CAUTION]\n> Only repository owners, members, and collaborators can use the \`/lysbot merge\` command.\n>\n> Your association: \`${authorAssociation}\``,
      );
      return { status: 'failed', message: 'Invalid author association' };
    }

    const permission = await this.repository.getCollaboratorPermission(owner, repo, actor);
    if (!hasValidPermission(permission)) {
      await this.repository.postComment(
        owner,
        repo,
        prNumber,
        `## Permission denied\n\n> [!CAUTION]\n> You need at least **write** permission on this repository to use the \`/lysbot merge\` command.\n>\n> Your association: \`${authorAssociation}\`\n> Your permission level: \`${permission}\``,
      );
      return { status: 'failed', message: 'Insufficient permissions' };
    }

    let prData = await this.repository.fetchPullRequestData(owner, repo, prNumber);

    // Fork check
    if (prData.isFork) {
      await this.repository.postComment(
        owner,
        repo,
        prNumber,
        '## Fork PR not supported\n\n> [!WARNING]\n> The `/lysbot merge` command is not supported for PRs from forked repositories.\n>\n> This is because the GITHUB_TOKEN has limited write permissions for fork-originated PRs by default.',
      );
      return { status: 'failed', message: 'Fork PR not supported' };
    }

    // Already merged check
    if (prData.merged) {
      await this.repository.postComment(
        owner,
        repo,
        prNumber,
        '## Already merged\n\nThis PR has already been merged.',
      );
      return { status: 'already_merged', message: 'PR already merged' };
    }

    // Perform all validation checks
    const checks = await this.performValidationChecks(owner, repo, prNumber, prData, mergeOptions);

    const checksMarkdown = buildCheckResultsMarkdown(checks);
    const mergeMethodResult = determineMergeMethod(prData.headRef, prData.baseRef, config);
    const allPassed = checks.filter((c) => !c.optional).every((c) => c.passed);

    if (!allPassed) {
      await this.repository.postComment(
        owner,
        repo,
        prNumber,
        `## Merge checks failed\n\nThe following checks must pass before merging:\n\n${checksMarkdown}\n\n### Merge Method\n\n- **Method:** \`${mergeMethodResult.method}\`\n- **Reason:** ${mergeMethodResult.reason}`,
      );
      return { status: 'failed', message: 'Merge checks failed' };
    }

    await this.repository.postComment(
      owner,
      repo,
      prNumber,
      `## Merge checks passed\n\nAll checks passed. Proceeding to merge...\n\n${checksMarkdown}\n\n### Merge Method\n\n- **Method:** \`${mergeMethodResult.method}\`\n- **Reason:** ${mergeMethodResult.reason}`,
    );

    // TOCTOU check and mergeability wait
    const originalHeadSha = prData.headSha;
    prData = await this.repository.fetchPullRequestData(owner, repo, prNumber);

    if (prData.headSha !== originalHeadSha) {
      await this.repository.postComment(
        owner,
        repo,
        prNumber,
        `## New commits detected\n\n> [!WARNING]\n> New commits were pushed while validating this PR.\n>\n> - Original HEAD SHA: ${originalHeadSha}\n> - Current HEAD SHA: ${prData.headSha}\n>\n> Please run \`/lysbot merge\` again after the new commits are reviewed and approved.`,
      );
      return { status: 'failed', message: 'TOCTOU violation' };
    }

    // Wait for mergeability status
    const mergeabilityResult = await this.waitForMergeability(owner, repo, prNumber, prData, originalHeadSha, config);
    if (mergeabilityResult.error) {
      await this.repository.postComment(owner, repo, prNumber, mergeabilityResult.error);
      return { status: 'failed', message: mergeabilityResult.message ?? 'Mergeability check failed' };
    }
    prData = mergeabilityResult.prData;

    // Perform the merge
    const approvalOverridden = mergeOptions.overrideApprovalRequirement && checks.some((c) => c.name.includes('approval') && !c.passed);
    const { commitTitle, commitMessage } = this.buildCommitMessage(
      mergeMethodResult.method,
      prNumber,
      prData,
      actor,
      approvalOverridden,
    );

    const commits =
      mergeMethodResult.method === 'squash'
        ? await this.repository.fetchPullRequestCommits(owner, repo, prNumber)
        : [];
    const finalMessage =
      mergeMethodResult.method === 'squash'
        ? this.commitService.buildSquashCommitMessage(prNumber, prData.title, commits, actor, approvalOverridden)
            .commitMessage
        : commitMessage;

    const mergeResult = await this.repository.mergePullRequest(
      owner,
      repo,
      prNumber,
      mergeMethodResult.method,
      originalHeadSha,
      commitTitle,
      finalMessage,
    );

    if (!mergeResult.success) {
      await this.repository.postComment(
        owner,
        repo,
        prNumber,
        `## Merge failed\n\n> [!CAUTION]\n> Failed to merge PR:\n>\n> - Error: ${mergeResult.error}\n>\n> Please check the PR status and try again.`,
      );
      return { status: 'failed', message: `Merge failed: ${mergeResult.error}` };
    }

    let mergeCommitInfo = '';
    if (mergeResult.mergeCommitSha) {
      mergeCommitInfo = `\n- **Merge Commit SHA:** ${mergeResult.mergeCommitSha}`;
    }

    await this.repository.postComment(
      owner,
      repo,
      prNumber,
      `## Merged by lysbot-merge\n\nThis PR has been successfully merged.\n\n### Details\n\n- **Merge Method:** \`${mergeMethodResult.method}\`\n- **Base Branch:** \`${prData.baseRef}\`\n- **Head Branch:** \`${prData.headRef}\`\n- **HEAD SHA:** ${originalHeadSha}${mergeCommitInfo}`,
    );

    return {
      status: 'merged',
      message: 'PR merged successfully',
      mergeMethod: mergeMethodResult.method,
    };
  }

  private async performValidationChecks(
    owner: string,
    repo: string,
    prNumber: number,
    prData: PullRequestData,
    mergeOptions: MergeOptions,
  ): Promise<CheckResult[]> {
    const checks: CheckResult[] = [];

    // PR state checks
    checks.push(...validatePRState(prData));

    // Review threads check
    const unresolvedCount = await this.repository.countUnresolvedThreads(owner, repo, prNumber);
    checks.push({
      name: 'All review conversations are resolved',
      passed: unresolvedCount === 0,
      ...(unresolvedCount > 0 && { details: `${unresolvedCount} unresolved` }),
    });

    // Approval checks
    const approvedReviews = await this.repository.fetchApprovedReviews(owner, repo, prNumber);
    let validApprovals = 0;
    const dismissFailures: string[] = [];

    for (const review of approvedReviews) {
      if (review.user?.login === prData.author) {
        continue;
      }

      if (review.commit_id !== prData.headSha) {
        const message = `Approval dismissed: New commits were pushed after this review was submitted (reviewed commit: ${review.commit_id?.slice(0, 7)}, current HEAD: ${prData.headSha.slice(0, 7)}).`;
        const dismissed = await this.repository.dismissReview(owner, repo, prNumber, review.id, message);
        if (!dismissed) {
          dismissFailures.push(
            `- Failed to dismiss approval from @${review.user?.login} (insufficient permissions or branch protection settings)`,
          );
        }
      } else {
        validApprovals++;
      }
    }

    if (dismissFailures.length > 0) {
      const staleComment = `## Stale approval dismiss failures\n\n> [!WARNING]\n> The following approvals could not be dismissed (consider enabling "Dismiss stale pull request approvals when new commits are pushed" in branch protection settings):\n>\n${dismissFailures.map((f) => `> ${f}`).join('\n')}`;
      await this.repository.postComment(owner, repo, prNumber, staleComment);
    }

    const approvalCheckPassed = validApprovals >= 1;
    const approvalOverridden = mergeOptions.overrideApprovalRequirement && !approvalCheckPassed;

    if (approvalOverridden) {
      core.info('Approval requirement overridden by command flag (--override-approval-requirement).');
    }

    let approvalDetails: string | undefined;
    if (approvalCheckPassed) {
      approvalDetails = undefined;
    } else if (approvalOverridden) {
      approvalDetails = 'approval requirement overridden by `--override-approval-requirement`; no valid approvals found';
    } else {
      approvalDetails = 'no valid approvals found';
    }

    checks.push({
      name: 'At least one valid approval from another user',
      passed: approvalCheckPassed,
      ...(approvalDetails !== undefined && { details: approvalDetails }),
      ...(approvalOverridden && { optional: true }),
    });

    // Conflicts check
    const noConflicts = prData.mergeableState === 'clean';
    checks.push({
      name: 'No merge conflicts',
      passed: noConflicts,
      ...(!noConflicts && { details: getMergeableStateDescription(prData.mergeableState) }),
    });

    // Conventional commits check (optional)
    const isConventionalTitle = isConventionalCommitTitle(prData.title);
    checks.push({
      name: 'PR title follows [Conventional Commits](https://www.conventionalcommits.org/)',
      passed: isConventionalTitle,
      ...(!isConventionalTitle && { details: 'title does not follow conventional format' }),
      optional: true,
    });

    return checks;
  }

  private async waitForMergeability(
    owner: string,
    repo: string,
    prNumber: number,
    prData: PullRequestData,
    originalHeadSha: string,
    config: ActionConfig,
  ): Promise<{ prData: PullRequestData; error?: string; message?: string }> {
    let retries = 0;
    let currentPrData = prData;

    while (currentPrData.mergeable === null && retries < config.mergeableRetryCount) {
      await waitBeforeRetryMs(config.mergeableRetryInterval * 1000);
      currentPrData = await this.repository.fetchPullRequestData(owner, repo, prNumber);
      retries++;

      if (currentPrData.headSha !== originalHeadSha) {
        return {
          prData: currentPrData,
          error: `## New commits detected\n\n> [!WARNING]\n> New commits were pushed while validating this PR (after waiting for mergeable status).\n>\n> - Original HEAD SHA: ${originalHeadSha}\n> - Current HEAD SHA: ${currentPrData.headSha}\n>\n> Please run \`/lysbot merge\` again after the new commits are reviewed and approved.`,
          message: 'TOCTOU violation during retry',
        };
      }
    }

    if (
      currentPrData.mergeable === false ||
      currentPrData.mergeable === null ||
      currentPrData.mergeableState === 'dirty'
    ) {
      let errorComment: string;
      if (currentPrData.mergeable === null) {
        errorComment = `## Mergeability status pending\n\n> [!NOTE]\n> GitHub is still calculating mergeability for this PR.\n>\n> - Mergeable: \`null\`\n> - Mergeable State: \`${currentPrData.mergeableState}\`\n> - Retries: count=${config.mergeableRetryCount}, interval=${config.mergeableRetryInterval}s\n>\n> Please try \`/lysbot merge\` again shortly.`;
      } else if (currentPrData.mergeableState === 'dirty') {
        errorComment = `## Conflicts detected\n\n> [!CAUTION]\n> This PR has merge conflicts that must be resolved before merging.\n>\n> - Mergeable: \`${currentPrData.mergeable}\`\n> - Mergeable State: \`${currentPrData.mergeableState}\`\n>\n> Please resolve the conflicts and try again.`;
      } else {
        errorComment = `## Cannot merge\n\n> [!CAUTION]\n> This PR cannot be merged:\n>\n> - Mergeable: \`${currentPrData.mergeable}\`\n> - Mergeable State: \`${currentPrData.mergeableState}\`\n>\n> Please resolve any conflicts or issues before attempting to merge.`;
      }
      return { prData: currentPrData, error: errorComment, message: 'Not mergeable' };
    }

    return { prData: currentPrData };
  }

  private buildCommitMessage(
    method: 'squash' | 'merge',
    prNumber: number,
    prData: PullRequestData,
    actor: string,
    approvalOverridden: boolean,
  ): { commitTitle: string; commitMessage: string } {
    if (method === 'merge') {
      return this.commitService.buildMergeCommitMessage(prNumber, prData.title, prData.headRef, actor, approvalOverridden);
    } else {
      // For squash, we'll return a placeholder here and fetch commits later
      return { commitTitle: `${prData.title} (#${prNumber})`, commitMessage: '' };
    }
  }
}
