/**
 * MergePullRequestUseCase - Application workflow for merging a PR
 *
 * This use case orchestrates the domain objects and services to achieve
 * the goal of validating and merging a pull request based on a command.
 *
 * It depends only on domain layer and port interfaces (not adapters).
 */

import type { MergeCheckResult } from '../../domain/entities/MergeCheckResult.js';
import type { PullRequest } from '../../domain/entities/PullRequest.js';
import { determineMergeMethod } from '../../domain/services/MergeMethodService.js';
import {
  isBot,
  parseCommand,
  hasValidAuthorAssociation,
  hasValidPermission,
  validatePRState,
  getMergeableStateDescription,
  isConventionalCommitTitle,
  waitBeforeRetryMs,
} from '../../domain/services/ValidationService.js';
import type { GitHubClient } from '../ports/GitHubClient.js';
import type { Logger } from '../ports/Logger.js';

import type { MergePullRequestInput, MergePullRequestOutput } from './MergePullRequestDTO.js';

/**
 * Use case for merging a pull request
 */
export class MergePullRequestUseCase {
  constructor(
    private readonly githubClient: GitHubClient,
    private readonly logger: Logger,
  ) {}

  /**
   * Executes the merge PR use case
   *
   * This function:
   * 1. Validates the command and permissions
   * 2. Checks PR state and approval status
   * 3. Performs the merge if all checks pass
   * 4. Posts appropriate comments for feedback
   *
   * @param input - Input data for the use case
   * @returns Result of the operation
   */
  async execute(input: MergePullRequestInput): Promise<MergePullRequestOutput> {
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
      mergeConfig,
      retryConfig,
    } = input;

    // -------------------------------------------------------------------------
    // Step 1: Validate event type and context
    // -------------------------------------------------------------------------

    // Validate event type - this action only works with issue_comment events
    if (eventName !== 'issue_comment') {
      return { status: 'skipped', message: 'This action only runs on issue_comment events' };
    }

    // Check if this is a PR comment (not an issue comment)
    if (!isPullRequest) {
      return { status: 'skipped', message: 'Comment is not on a PR, skipping' };
    }

    // Skip if bot
    if (isBot(userType)) {
      return { status: 'skipped', message: 'Comment is from a bot' };
    }

    // Parse and validate the merge command
    const mergeOptions = parseCommand(commentBody);
    if (!mergeOptions) {
      return { status: 'skipped', message: 'Command not matched' };
    }

    // Add eyes reaction for immediate feedback
    await this.githubClient.addReaction(owner, repo, commentId, 'eyes');

    // Check author association
    if (!hasValidAuthorAssociation(authorAssociation)) {
      await this.githubClient.postComment(
        owner,
        repo,
        prNumber,
        `## Permission denied\n\n> [!CAUTION]\n> Only repository owners, members, and collaborators can use the \`/lysbot merge\` command.\n>\n> Your association: \`${authorAssociation}\``,
      );
      return { status: 'failed', message: 'Invalid author association' };
    }

    // Check permission level
    const permission = await this.githubClient.getCollaboratorPermission(owner, repo, actor);
    if (!hasValidPermission(permission)) {
      await this.githubClient.postComment(
        owner,
        repo,
        prNumber,
        `## Permission denied\n\n> [!CAUTION]\n> You need at least **write** permission on this repository to use the \`/lysbot merge\` command.\n>\n> Your association: \`${authorAssociation}\`\n> Your permission level: \`${permission}\``,
      );
      return { status: 'failed', message: 'Insufficient permissions' };
    }

    // -------------------------------------------------------------------------
    // Step 2: Validate user permissions and fetch PR data
    // -------------------------------------------------------------------------

    let pr = await this.githubClient.fetchPullRequest(owner, repo, prNumber);

    // Why: GITHUB_TOKEN has limited write permissions for fork PRs by default.
    // Merge operations would fail, so we reject early with a clear message.
    if (pr.isFork) {
      await this.githubClient.postComment(
        owner,
        repo,
        prNumber,
        '## Fork PR not supported\n\n> [!WARNING]\n> The `/lysbot merge` command is not supported for PRs from forked repositories.\n>\n> This is because the GITHUB_TOKEN has limited write permissions for fork-originated PRs by default.',
      );
      return { status: 'failed', message: 'Fork PR not supported' };
    }

    // Check if already merged
    if (pr.merged) {
      await this.githubClient.postComment(
        owner,
        repo,
        prNumber,
        '## Already merged\n\nThis PR has already been merged.',
      );
      return { status: 'already_merged', message: 'PR already merged' };
    }

    // -------------------------------------------------------------------------
    // Step 3: Run validation checks
    // -------------------------------------------------------------------------

    // PR state checks (open, unlocked, ready)
    const prStateChecks = validatePRState(pr);

    // Unresolved threads check
    const unresolvedCount = await this.githubClient.countUnresolvedThreads(owner, repo, prNumber);
    const threadsCheck: MergeCheckResult = {
      name: 'All review conversations are resolved',
      passed: unresolvedCount === 0,
      ...(unresolvedCount > 0 && { details: `${unresolvedCount} unresolved` }),
    };

    // Approval check - fetch and validate reviews
    const approvedReviews = await this.githubClient.fetchApprovedReviews(owner, repo, prNumber);
    let validApprovals = 0;
    const dismissFailures: string[] = [];

    for (const review of approvedReviews) {
      // Skip self-approval
      if (review.user?.login === pr.author) {
        continue;
      }

      // Check if review is stale (not on current HEAD)
      // Note: commit_id can be null in some GitHub configurations
      // We only dismiss if commit_id exists and differs from current HEAD
      if (review.commit_id !== null && review.commit_id !== pr.headSha) {
        const message = `Approval dismissed: New commits were pushed after this review was submitted (reviewed commit: ${review.commit_id.slice(0, 7)}, current HEAD: ${pr.headSha.slice(0, 7)}).`;
        const dismissed = await this.githubClient.dismissReview(owner, repo, prNumber, review.id, message);
        if (!dismissed) {
          dismissFailures.push(
            `- Failed to dismiss approval from @${review.user?.login} (insufficient permissions or branch protection settings)`,
          );
        }
      } else if (review.commit_id === null || review.commit_id === pr.headSha) {
        // Count as valid approval if commit_id is null or matches current HEAD
        validApprovals++;
      }
    }

    // Post stale dismissal notification only when there are failures
    if (dismissFailures.length > 0) {
      const staleComment = `## Stale approval dismiss failures\n\n> [!WARNING]\n> The following approvals could not be dismissed (consider enabling "Dismiss stale pull request approvals when new commits are pushed" in branch protection settings):\n>\n${dismissFailures.map((f) => `> ${f}`).join('\n')}`;
      await this.githubClient.postComment(owner, repo, prNumber, staleComment);
    }

    // Determine if approval requirement is overridden
    const approvalCheckPassed = validApprovals >= 1;
    const approvalOverridden = mergeOptions.overrideApprovalRequirement && !approvalCheckPassed;

    // Log when approval requirement is overridden
    if (approvalOverridden) {
      this.logger.info('Approval requirement overridden by command flag (--override-approval-requirement).');
    }

    // Build approval check result
    let approvalDetails: string | undefined;
    if (approvalCheckPassed) {
      approvalDetails = undefined;
    } else if (approvalOverridden) {
      approvalDetails =
        'approval requirement overridden by `--override-approval-requirement`; no valid approvals found';
    } else {
      approvalDetails = 'no valid approvals found';
    }

    const approvalCheck: MergeCheckResult = {
      name: 'At least one valid approval from another user',
      passed: approvalCheckPassed,
      ...(approvalDetails !== undefined && { details: approvalDetails }),
      // Mark as optional when override flag is used
      ...(approvalOverridden && { optional: true }),
    };

    // Merge conflicts check (based on mergeable_state)
    const noConflicts = pr.mergeableState === 'clean';
    const conflictsCheck: MergeCheckResult = {
      name: 'No merge conflicts',
      passed: noConflicts,
      ...(!noConflicts && { details: getMergeableStateDescription(pr.mergeableState) }),
    };

    // Optional: Conventional Commits check for PR title
    const isConventionalTitle = isConventionalCommitTitle(pr.title);
    const conventionalCommitsCheck: MergeCheckResult = {
      name: 'PR title follows [Conventional Commits](https://www.conventionalcommits.org/)',
      passed: isConventionalTitle,
      ...(!isConventionalTitle && { details: 'title does not follow conventional format' }),
      optional: true,
    };

    // Determine merge method
    const mergeMethodResult = determineMergeMethod(pr.headRef, pr.baseRef, mergeConfig);

    // Build checks array in the final order
    const checks: MergeCheckResult[] = [
      ...prStateChecks,
      threadsCheck,
      approvalCheck,
      conflictsCheck,
      conventionalCommitsCheck,
    ];

    // Only required (non-optional) checks must pass
    const allPassed = checks.filter((c) => !c.optional).every((c) => c.passed);

    // -------------------------------------------------------------------------
    // Step 4: Report results and merge if all passed
    // -------------------------------------------------------------------------

    if (!allPassed) {
      const checksMarkdown = this.buildCheckResultsMarkdown(checks);
      await this.githubClient.postComment(
        owner,
        repo,
        prNumber,
        `## Merge checks failed\n\nThe following checks must pass before merging:\n\n${checksMarkdown}\n\n### Merge Method\n\n- **Method:** \`${mergeMethodResult.method}\`\n- **Reason:** ${mergeMethodResult.reason}`,
      );
      return { status: 'failed', message: 'Merge checks failed' };
    }

    // All checks passed - post status and proceed to merge
    const checksMarkdown = this.buildCheckResultsMarkdown(checks);
    await this.githubClient.postComment(
      owner,
      repo,
      prNumber,
      `## Merge checks passed\n\nAll checks passed. Proceeding to merge...\n\n${checksMarkdown}\n\n### Merge Method\n\n- **Method:** \`${mergeMethodResult.method}\`\n- **Reason:** ${mergeMethodResult.reason}`,
    );

    // -------------------------------------------------------------------------
    // Step 5: TOCTOU check and merge
    // -------------------------------------------------------------------------

    const originalHeadSha = pr.headSha;

    // Re-fetch PR data for TOCTOU check
    pr = await this.githubClient.fetchPullRequest(owner, repo, prNumber);

    if (pr.headSha !== originalHeadSha) {
      await this.githubClient.postComment(
        owner,
        repo,
        prNumber,
        `## New commits detected\n\n> [!WARNING]\n> New commits were pushed while validating this PR.\n>\n> - Original HEAD SHA: ${originalHeadSha}\n> - Current HEAD SHA: ${pr.headSha}\n>\n> Please run \`/lysbot merge\` again after the new commits are reviewed and approved.`,
      );
      return { status: 'failed', message: 'TOCTOU violation' };
    }

    // Why: GitHub API returns mergeable=null while computing merge status asynchronously.
    // This typically happens on first fetch after PR update. We retry to wait for computation.
    let retries = 0;
    while (pr.mergeable === null && retries < retryConfig.mergeableRetryCount) {
      await waitBeforeRetryMs(retryConfig.mergeableRetryInterval * 1000);
      pr = await this.githubClient.fetchPullRequest(owner, repo, prNumber);
      retries++;

      // TOCTOU check during retry
      if (pr.headSha !== originalHeadSha) {
        await this.githubClient.postComment(
          owner,
          repo,
          prNumber,
          `## New commits detected\n\n> [!WARNING]\n> New commits were pushed while validating this PR (after waiting for mergeable status).\n>\n> - Original HEAD SHA: ${originalHeadSha}\n> - Current HEAD SHA: ${pr.headSha}\n>\n> Please run \`/lysbot merge\` again after the new commits are reviewed and approved.`,
        );
        return { status: 'failed', message: 'TOCTOU violation during retry' };
      }
    }

    // Check final mergeability
    if (pr.mergeable === false || pr.mergeable === null || pr.mergeableState === 'dirty') {
      let errorComment: string;
      if (pr.mergeable === null) {
        errorComment = `## Mergeability status pending\n\n> [!NOTE]\n> GitHub is still calculating mergeability for this PR.\n>\n> - Mergeable: \`null\`\n> - Mergeable State: \`${pr.mergeableState}\`\n> - Retries: count=${retryConfig.mergeableRetryCount}, interval=${retryConfig.mergeableRetryInterval}s\n>\n> Please try \`/lysbot merge\` again shortly.`;
      } else if (pr.mergeableState === 'dirty') {
        errorComment = `## Conflicts detected\n\n> [!CAUTION]\n> This PR has merge conflicts that must be resolved before merging.\n>\n> - Mergeable: \`${pr.mergeable}\`\n> - Mergeable State: \`${pr.mergeableState}\`\n>\n> Please resolve the conflicts and try again.`;
      } else {
        errorComment = `## Cannot merge\n\n> [!CAUTION]\n> This PR cannot be merged:\n>\n> - Mergeable: \`${pr.mergeable}\`\n> - Mergeable State: \`${pr.mergeableState}\`\n>\n> Please resolve any conflicts or issues before attempting to merge.`;
      }
      await this.githubClient.postComment(owner, repo, prNumber, errorComment);
      return { status: 'failed', message: 'Not mergeable' };
    }

    // Perform merge
    const { commitTitle, commitBody } = await this.buildCommitMessage(
      owner,
      repo,
      prNumber,
      pr,
      mergeMethodResult.method,
      actor,
      approvalOverridden,
    );

    const mergeResult = await this.githubClient.mergePullRequest(
      owner,
      repo,
      prNumber,
      mergeMethodResult.method,
      originalHeadSha,
      commitTitle,
      commitBody,
    );

    if (!mergeResult.success) {
      await this.githubClient.postComment(
        owner,
        repo,
        prNumber,
        `## Merge failed\n\n> [!CAUTION]\n> Failed to merge PR:\n>\n> - Error: ${mergeResult.error}\n>\n> Please check the PR status and try again.`,
      );
      return { status: 'failed', message: `Merge failed: ${mergeResult.error}` };
    }

    // Post success comment
    let mergeCommitInfo = '';
    if (mergeResult.mergeCommitSha) {
      mergeCommitInfo = `\n- **Merge Commit SHA:** ${mergeResult.mergeCommitSha}`;
    }

    await this.githubClient.postComment(
      owner,
      repo,
      prNumber,
      `## Merged by lysbot-merge\n\nThis PR has been successfully merged.\n\n### Details\n\n- **Merge Method:** \`${mergeMethodResult.method}\`\n- **Base Branch:** \`${pr.baseRef}\`\n- **Head Branch:** \`${pr.headRef}\`\n- **HEAD SHA:** ${originalHeadSha}${mergeCommitInfo}`,
    );

    return {
      status: 'merged',
      message: 'PR merged successfully',
      mergeMethod: mergeMethodResult.method,
    };
  }

  /**
   * Builds the check results markdown
   */
  private buildCheckResultsMarkdown(checks: MergeCheckResult[]): string {
    const TWEMOJI = {
      CHECK:
        '<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/2705.svg" width="20" height="20" alt="OK">',
      CROSS:
        '<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/274c.svg" width="20" height="20" alt="NG">',
      WARNING:
        '<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/26a0.svg" width="20" height="20" alt="Warning">',
    };

    return checks
      .map((check) => {
        let icon: string;
        if (check.passed) {
          icon = TWEMOJI.CHECK;
        } else if (check.optional) {
          icon = TWEMOJI.WARNING;
        } else {
          icon = TWEMOJI.CROSS;
        }
        const detail = check.details ? ` (${check.details})` : '';
        return `- ${icon} ${check.name}${detail}`;
      })
      .join('\n');
  }

  /**
   * Builds the commit message for merge operations
   */
  private async buildCommitMessage(
    owner: string,
    repo: string,
    prNumber: number,
    pr: PullRequest,
    method: 'squash' | 'merge',
    actor: string,
    approvalOverridden: boolean,
  ): Promise<{ commitTitle: string; commitBody: string }> {
    let commitTitle: string;
    let commitBody: string;

    // Build additional metadata that goes in the commit body
    let additionalMessages = `Merged-by: lysbot-merge (on behalf of @${actor})`;
    if (approvalOverridden) {
      // Note: Warning format for exceptional merges
      additionalMessages += `\n\nWARNING: EXCEPTIONAL MERGE - Approval requirement overridden via --override-approval-requirement`;
    }

    if (method === 'merge') {
      // For merge commits:
      // Title: Merge pull request #{PR_NUMBER} from {PR_MERGE_HEAD}
      // Body: {PR_TITLE}\n\n{ADDITIONAL_MESSAGES}
      commitTitle = `Merge pull request #${prNumber} from ${pr.headRef}`;
      commitBody = `${pr.title}\n\n${additionalMessages}`;
    } else {
      // For squash commits:
      // Title: {PR_TITLE} (#{PR_NUMBER})
      // Body: * {COMMIT_TITLE_01}\n* {COMMIT_TITLE_02}\n...\n\nCo-authored-by: ...\n\n{ADDITIONAL_MESSAGES}
      commitTitle = `${pr.title} (#${prNumber})`;

      // Fetch commits to list their titles and collect co-authors
      const commits = await this.githubClient.fetchPullRequestCommits(owner, repo, prNumber);
      const commitTitles = commits
        .map((c) => {
          // Extract first line of commit message (commit title)
          const message = c.commit.message || '';
          const firstLine = message.split('\n')[0];
          return firstLine ? `* ${firstLine}` : '';
        })
        .filter((title) => title !== ''); // Filter out empty entries

      // Collect unique co-authors from commits in order
      const coAuthors: string[] = [];
      commits.forEach((c) => {
        const author = c.commit.author;
        if (author?.name && author?.email) {
          const authorLine = `Co-authored-by: ${author.name} <${author.email}>`;
          if (!coAuthors.includes(authorLine)) {
            coAuthors.push(authorLine);
          }
        }
      });

      // Build commit body with commit titles, co-authors, and additional messages
      const bodyParts: string[] = [];

      if (commitTitles.length > 0) {
        bodyParts.push(commitTitles.join('\n'));
      }

      if (coAuthors.length > 0) {
        bodyParts.push(coAuthors.join('\n'));
      }

      bodyParts.push(additionalMessages);

      commitBody = bodyParts.join('\n\n');
    }

    return { commitTitle, commitBody };
  }
}
