/**
 * MergeUseCase.ts - Main use case for PR merge operations
 *
 * This is the application business logic layer that orchestrates
 * the merge operation using domain services and external ports.
 */

import type { IGitHubClient } from './IGitHubClient.js';
import type { ILogger } from './ILogger.js';
import type { EventContext, MergeConfig } from './MergeUseCaseInput.js';
import type { MergeResult } from '../../domain/value-objects/MergeResult.js';
import type { MergeCheck } from '../../domain/entities/MergeCheck.js';
import type { PullRequest } from '../../domain/entities/PullRequest.js';
import { CommandParser } from '../../domain/services/CommandParser.js';
import { PermissionChecker } from '../../domain/services/PermissionChecker.js';
import { PullRequestValidator } from '../../domain/services/PullRequestValidator.js';
import { ConventionalCommitsValidator } from '../../domain/services/ConventionalCommitsValidator.js';
import { MergeMethodPolicy } from '../../domain/services/MergeMethodPolicy.js';

/**
 * Waits for a specified number of milliseconds before retrying.
 */
function waitBeforeRetryMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main use case for merging pull requests.
 * Orchestrates the merge workflow using domain services and external ports.
 */
export class MergeUseCase {
  private readonly commandParser: CommandParser;
  private readonly permissionChecker: PermissionChecker;
  private readonly prValidator: PullRequestValidator;
  private readonly conventionalCommitsValidator: ConventionalCommitsValidator;
  private readonly mergeMethodPolicy: MergeMethodPolicy;

  constructor(
    private readonly gitHubClient: IGitHubClient,
    private readonly logger: ILogger,
    config: MergeConfig,
  ) {
    this.commandParser = new CommandParser();
    this.permissionChecker = new PermissionChecker();
    this.prValidator = new PullRequestValidator();
    this.conventionalCommitsValidator = new ConventionalCommitsValidator();
    this.mergeMethodPolicy = new MergeMethodPolicy({
      releaseBranchPrefix: config.releaseBranchPrefix,
      developBranch: config.developBranch,
      syncBranchPrefix: config.syncBranchPrefix,
    });
  }

  /**
   * Executes the merge use case.
   */
  async execute(context: EventContext, config: MergeConfig): Promise<MergeResult> {
    // Step 1: Validate event type and context
    const validationResult = this.validateEventContext(context);
    if (validationResult) {
      return validationResult;
    }

    // Parse and validate the merge command
    const mergeCommand = this.commandParser.parse(context.commentBody);
    if (!mergeCommand) {
      return { status: 'skipped', message: 'Command not matched' };
    }

    // Add eyes reaction for immediate feedback
    await this.gitHubClient.addReaction(context.commentId, 'eyes');

    // Step 2: Validate user permissions
    const permissionResult = await this.validatePermissions(context);
    if (permissionResult) {
      return permissionResult;
    }

    // Step 3: Fetch and validate PR data
    let pr = await this.gitHubClient.fetchPullRequest(context.prNumber);

    // Check if fork PR
    if (pr.isFork) {
      await this.gitHubClient.postComment(
        context.prNumber,
        '## Fork PR not supported\n\n> [!WARNING]\n> The `/lysbot merge` command is not supported for PRs from forked repositories.\n>\n> This is because the GITHUB_TOKEN has limited write permissions for fork-originated PRs by default.',
      );
      return { status: 'failed', message: 'Fork PR not supported' };
    }

    // Check if already merged
    if (pr.merged) {
      await this.gitHubClient.postComment(context.prNumber, '## Already merged\n\nThis PR has already been merged.');
      return { status: 'already_merged', message: 'PR already merged' };
    }

    // Step 4: Perform all merge checks
    const { checks, allPassed } = await this.performMergeChecks(context, pr, mergeCommand.overrideApprovalRequirement);

    // Determine merge method
    const mergeMethod = this.mergeMethodPolicy.determine(pr.headRef, pr.baseRef);

    // Build checks markdown
    const checksMarkdown = this.buildCheckResultsMarkdown(checks);

    // Report results
    if (!allPassed) {
      await this.gitHubClient.postComment(
        context.prNumber,
        `## Merge checks failed\n\nThe following checks must pass before merging:\n\n${checksMarkdown}\n\n### Merge Method\n\n- **Method:** \`${mergeMethod.method}\`\n- **Reason:** ${mergeMethod.reason}`,
      );
      return { status: 'failed', message: 'Merge checks failed' };
    }

    // All checks passed - post status and proceed to merge
    await this.gitHubClient.postComment(
      context.prNumber,
      `## Merge checks passed\n\nAll checks passed. Proceeding to merge...\n\n${checksMarkdown}\n\n### Merge Method\n\n- **Method:** \`${mergeMethod.method}\`\n- **Reason:** ${mergeMethod.reason}`,
    );

    // Step 5: Perform merge with TOCTOU check
    return await this.performMerge(context, pr, config, mergeMethod.method, mergeCommand.overrideApprovalRequirement);
  }

  /**
   * Validates the event context.
   */
  private validateEventContext(context: EventContext): MergeResult | null {
    // Validate event type
    if (context.eventName !== 'issue_comment') {
      return { status: 'skipped', message: 'This action only runs on issue_comment events' };
    }

    // Check if this is a PR comment
    if (!context.isPullRequest) {
      return { status: 'skipped', message: 'Comment is not on a PR, skipping' };
    }

    // Skip if bot
    if (this.permissionChecker.isBot(context.userType)) {
      return { status: 'skipped', message: 'Comment is from a bot' };
    }

    return null;
  }

  /**
   * Validates user permissions.
   */
  private async validatePermissions(context: EventContext): Promise<MergeResult | null> {
    // Check author association
    if (!this.permissionChecker.hasValidAuthorAssociation(context.authorAssociation)) {
      await this.gitHubClient.postComment(
        context.prNumber,
        `## Permission denied\n\n> [!CAUTION]\n> Only repository owners, members, and collaborators can use the \`/lysbot merge\` command.\n>\n> Your association: \`${context.authorAssociation}\``,
      );
      return { status: 'failed', message: 'Invalid author association' };
    }

    // Check permission level
    const permission = await this.gitHubClient.getCollaboratorPermission(context.actor);
    if (!this.permissionChecker.hasValidPermission(permission)) {
      await this.gitHubClient.postComment(
        context.prNumber,
        `## Permission denied\n\n> [!CAUTION]\n> You need at least **write** permission on this repository to use the \`/lysbot merge\` command.\n>\n> Your association: \`${context.authorAssociation}\`\n> Your permission level: \`${permission}\``,
      );
      return { status: 'failed', message: 'Insufficient permissions' };
    }

    return null;
  }

  /**
   * Performs all merge checks.
   */
  private async performMergeChecks(
    context: EventContext,
    pr: PullRequest,
    approvalOverridden: boolean,
  ): Promise<{ checks: MergeCheck[]; allPassed: boolean }> {
    const checks: MergeCheck[] = [];

    // PR state checks
    checks.push(...this.prValidator.validateState(pr));

    // Unresolved threads check
    const unresolvedCount = await this.gitHubClient.countUnresolvedThreads(context.prNumber);
    checks.push({
      name: 'All review conversations are resolved',
      passed: unresolvedCount === 0,
      ...(unresolvedCount > 0 && { details: `${unresolvedCount} unresolved` }),
    });

    // Approval check
    const approvalCheck = await this.checkApprovals(context, pr, approvalOverridden);
    checks.push(approvalCheck);

    // Merge conflicts check
    const noConflicts = pr.mergeableState === 'clean';
    checks.push({
      name: 'No merge conflicts',
      passed: noConflicts,
      ...(!noConflicts && { details: this.prValidator.getMergeableStateDescription(pr.mergeableState) }),
    });

    // Conventional Commits check
    const isConventionalTitle = this.conventionalCommitsValidator.isValid(pr.title);
    checks.push({
      name: 'PR title follows [Conventional Commits](https://www.conventionalcommits.org/)',
      passed: isConventionalTitle,
      ...(!isConventionalTitle && { details: 'title does not follow conventional format' }),
      optional: true,
    });

    // Only required checks must pass
    const allPassed = checks.filter((c) => !c.optional).every((c) => c.passed);

    return { checks, allPassed };
  }

  /**
   * Checks approval status.
   */
  private async checkApprovals(
    context: EventContext,
    pr: PullRequest,
    approvalOverridden: boolean,
  ): Promise<MergeCheck> {
    const approvedReviews = await this.gitHubClient.fetchApprovedReviews(context.prNumber);
    let validApprovals = 0;
    const dismissFailures: string[] = [];

    for (const review of approvedReviews) {
      // Skip self-approval
      if (review.user?.login === pr.author) {
        continue;
      }

      // Check if review is stale
      if (review.commit_id !== pr.headSha) {
        const message = `Approval dismissed: New commits were pushed after this review was submitted (reviewed commit: ${review.commit_id?.slice(0, 7)}, current HEAD: ${pr.headSha.slice(0, 7)}).`;
        const dismissed = await this.gitHubClient.dismissReview(context.prNumber, review.id, message);
        if (!dismissed) {
          dismissFailures.push(
            `- Failed to dismiss approval from @${review.user?.login} (insufficient permissions or branch protection settings)`,
          );
        }
      } else {
        validApprovals++;
      }
    }

    // Post stale dismissal notification only when there are failures
    if (dismissFailures.length > 0) {
      const staleComment = `## Stale approval dismiss failures\n\n> [!WARNING]\n> The following approvals could not be dismissed (consider enabling "Dismiss stale pull request approvals when new commits are pushed" in branch protection settings):\n>\n${dismissFailures.map((f) => `> ${f}`).join('\n')}`;
      await this.gitHubClient.postComment(context.prNumber, staleComment);
    }

    // Determine if approval requirement is overridden
    const approvalCheckPassed = validApprovals >= 1;
    const actuallyOverridden = approvalOverridden && !approvalCheckPassed;

    // Log when approval requirement is overridden
    if (actuallyOverridden) {
      this.logger.info('Approval requirement overridden by command flag (--override-approval-requirement).');
    }

    // Build approval check result
    let approvalDetails: string | undefined;
    if (approvalCheckPassed) {
      approvalDetails = undefined;
    } else if (actuallyOverridden) {
      approvalDetails = 'approval requirement overridden by `--override-approval-requirement`; no valid approvals found';
    } else {
      approvalDetails = 'no valid approvals found';
    }

    return {
      name: 'At least one valid approval from another user',
      passed: approvalCheckPassed,
      ...(approvalDetails !== undefined && { details: approvalDetails }),
      ...(actuallyOverridden && { optional: true }),
    };
  }

  /**
   * Performs the merge operation with TOCTOU check.
   */
  private async performMerge(
    context: EventContext,
    pr: PullRequest,
    config: MergeConfig,
    mergeMethod: 'squash' | 'merge',
    approvalOverridden: boolean,
  ): Promise<MergeResult> {
    const originalHeadSha = pr.headSha;

    // Re-fetch PR data for TOCTOU check
    pr = await this.gitHubClient.fetchPullRequest(context.prNumber);

    if (pr.headSha !== originalHeadSha) {
      await this.gitHubClient.postComment(
        context.prNumber,
        `## New commits detected\n\n> [!WARNING]\n> New commits were pushed while validating this PR.\n>\n> - Original HEAD SHA: ${originalHeadSha}\n> - Current HEAD SHA: ${pr.headSha}\n>\n> Please run \`/lysbot merge\` again after the new commits are reviewed and approved.`,
      );
      return { status: 'failed', message: 'TOCTOU violation' };
    }

    // Wait for mergeable status if needed
    const mergeableResult = await this.waitForMergeableStatus(context, pr, originalHeadSha, config);
    if (mergeableResult) {
      return mergeableResult;
    }

    // Build commit message
    const { commitTitle, commitBody } = await this.buildCommitMessage(context, pr, mergeMethod, approvalOverridden);

    // Perform merge
    const result = await this.gitHubClient.mergePullRequest(
      context.prNumber,
      mergeMethod,
      originalHeadSha,
      commitTitle,
      commitBody,
    );

    if (!result.success) {
      await this.gitHubClient.postComment(
        context.prNumber,
        `## Merge failed\n\n> [!CAUTION]\n> Failed to merge PR:\n>\n> - Error: ${result.error}\n>\n> Please check the PR status and try again.`,
      );
      return { status: 'failed', message: `Merge failed: ${result.error}` };
    }

    // Post success comment
    let mergeCommitInfo = '';
    if (result.mergeCommitSha) {
      mergeCommitInfo = `\n- **Merge Commit SHA:** ${result.mergeCommitSha}`;
    }

    await this.gitHubClient.postComment(
      context.prNumber,
      `## Merged by lysbot-merge\n\nThis PR has been successfully merged.\n\n### Details\n\n- **Merge Method:** \`${mergeMethod}\`\n- **Base Branch:** \`${pr.baseRef}\`\n- **Head Branch:** \`${pr.headRef}\`\n- **HEAD SHA:** ${originalHeadSha}${mergeCommitInfo}`,
    );

    return {
      status: 'merged',
      message: 'PR merged successfully',
      mergeMethod,
    };
  }

  /**
   * Waits for mergeable status to be computed.
   */
  private async waitForMergeableStatus(
    context: EventContext,
    pr: PullRequest,
    originalHeadSha: string,
    config: MergeConfig,
  ): Promise<MergeResult | null> {
    let retries = 0;
    while (pr.mergeable === null && retries < config.mergeableRetryCount) {
      await waitBeforeRetryMs(config.mergeableRetryInterval * 1000);
      pr = await this.gitHubClient.fetchPullRequest(context.prNumber);
      retries++;

      // TOCTOU check during retry
      if (pr.headSha !== originalHeadSha) {
        await this.gitHubClient.postComment(
          context.prNumber,
          `## New commits detected\n\n> [!WARNING]\n> New commits were pushed while validating this PR (after waiting for mergeable status).\n>\n> - Original HEAD SHA: ${originalHeadSha}\n> - Current HEAD SHA: ${pr.headSha}\n>\n> Please run \`/lysbot merge\` again after the new commits are reviewed and approved.`,
        );
        return { status: 'failed', message: 'TOCTOU violation during retry' };
      }
    }

    // Check final mergeability
    if (pr.mergeable === false || pr.mergeable === null || pr.mergeableState === 'dirty') {
      let errorComment: string;
      if (pr.mergeable === null) {
        errorComment = `## Mergeability status pending\n\n> [!NOTE]\n> GitHub is still calculating mergeability for this PR.\n>\n> - Mergeable: \`null\`\n> - Mergeable State: \`${pr.mergeableState}\`\n> - Retries: count=${config.mergeableRetryCount}, interval=${config.mergeableRetryInterval}s\n>\n> Please try \`/lysbot merge\` again shortly.`;
      } else if (pr.mergeableState === 'dirty') {
        errorComment = `## Conflicts detected\n\n> [!CAUTION]\n> This PR has merge conflicts that must be resolved before merging.\n>\n> - Mergeable: \`${pr.mergeable}\`\n> - Mergeable State: \`${pr.mergeableState}\`\n>\n> Please resolve the conflicts and try again.`;
      } else {
        errorComment = `## Cannot merge\n\n> [!CAUTION]\n> This PR cannot be merged:\n>\n> - Mergeable: \`${pr.mergeable}\`\n> - Mergeable State: \`${pr.mergeableState}\`\n>\n> Please resolve any conflicts or issues before attempting to merge.`;
      }
      await this.gitHubClient.postComment(context.prNumber, errorComment);
      return { status: 'failed', message: 'Not mergeable' };
    }

    return null;
  }

  /**
   * Builds commit message for merge.
   */
  private async buildCommitMessage(
    context: EventContext,
    pr: PullRequest,
    mergeMethod: 'squash' | 'merge',
    approvalOverridden: boolean,
  ): Promise<{ commitTitle: string; commitBody: string }> {
    // Build additional metadata
    let additionalMessages = `Merged-by: lysbot-merge (on behalf of @${context.actor})`;
    if (approvalOverridden) {
      additionalMessages += `\n\n⚠️ EXCEPTIONAL MERGE: Approval requirement overridden via --override-approval-requirement`;
    }

    if (mergeMethod === 'merge') {
      // For merge commits
      const commitTitle = `Merge pull request #${context.prNumber} from ${pr.headRef}`;
      const commitBody = `${pr.title}\n\n${additionalMessages}`;
      return { commitTitle, commitBody };
    } else {
      // For squash commits
      const commitTitle = `${pr.title} (#${context.prNumber})`;

      // Fetch commits
      const commits = await this.gitHubClient.fetchPullRequestCommits(context.prNumber);
      const commitTitles = commits
        .map((c) => {
          const message = c.commit.message || '';
          const firstLine = message.split('\n')[0];
          return firstLine ? `* ${firstLine}` : '';
        })
        .filter((title) => title !== '');

      // Collect unique co-authors
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

      // Build commit body
      const bodyParts: string[] = [];
      if (commitTitles.length > 0) {
        bodyParts.push(commitTitles.join('\n'));
      }
      if (coAuthors.length > 0) {
        bodyParts.push(coAuthors.join('\n'));
      }
      bodyParts.push(additionalMessages);

      const commitBody = bodyParts.join('\n\n');
      return { commitTitle, commitBody };
    }
  }

  /**
   * Builds check results markdown.
   */
  private buildCheckResultsMarkdown(checks: MergeCheck[]): string {
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
}
