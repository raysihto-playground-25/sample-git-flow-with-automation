/**
 * app.ts - Application layer with ports and orchestration logic
 *
 * This module defines the ports (interfaces) for external dependencies
 * and contains the orchestration logic for the merge operation.
 * 
 * ARCHITECTURE: This is the APP layer - it must NOT import from @actions/* or infra-shared.
 * It defines ports that will be implemented by the infra layer.
 */

import { Result } from '../../shared/kernel/index.js';
import type {
  ActionConfig,
  PullRequestData,
  CheckResult,
  MergeMethodResult,
  MergeOptions,
} from './domain.js';

/**
 * Event context from GitHub Actions runtime.
 */
export interface EventContext {
  owner: string;
  repo: string;
  prNumber: number;
  commentId: number;
  commentBody: string;
  actor: string;
  userType: string;
  authorAssociation: string;
  serverUrl: string;
  runId: number;
  eventName: string;
  isPullRequest: boolean;
}

/**
 * Result of the merge operation.
 */
export interface MergeResult {
  status: 'merged' | 'skipped' | 'failed' | 'already_merged';
  message: string;
  mergeMethod?: 'squash' | 'merge';
}

/**
 * Review data from GitHub API.
 */
export interface Review {
  id: number;
  state: string;
  commit_id: string | null;
  user: { login: string } | null;
}

/**
 * Commit data from GitHub API.
 */
export interface Commit {
  commit: {
    message: string;
    author?: {
      name?: string;
      email?: string;
    } | null;
  };
}

/**
 * Merge operation result.
 */
export interface MergeOperationResult {
  success: boolean;
  error?: string;
  mergeCommitSha?: string;
}

// ============================================================================
// PORTS - Interfaces for external dependencies
// ============================================================================

/**
 * Port for GitHub API operations.
 * The infra layer will implement this interface using Octokit.
 */
export interface IGitHubRepository {
  /**
   * Adds a reaction to a comment.
   */
  addReaction(
    owner: string,
    repo: string,
    commentId: number,
    reaction: '+1' | '-1' | 'laugh' | 'confused' | 'heart' | 'hooray' | 'rocket' | 'eyes',
  ): Promise<void>;

  /**
   * Posts a comment on a PR.
   */
  postComment(owner: string, repo: string, prNumber: number, body: string): Promise<void>;

  /**
   * Gets the collaborator permission level for a user.
   */
  getCollaboratorPermission(owner: string, repo: string, username: string): Promise<string>;

  /**
   * Fetches PR data from GitHub API.
   */
  fetchPullRequestData(owner: string, repo: string, prNumber: number): Promise<PullRequestData>;

  /**
   * Fetches all approved reviews for a PR.
   */
  fetchApprovedReviews(owner: string, repo: string, prNumber: number): Promise<Review[]>;

  /**
   * Dismisses a stale review.
   */
  dismissReview(
    owner: string,
    repo: string,
    prNumber: number,
    reviewId: number,
    message: string,
  ): Promise<boolean>;

  /**
   * Counts unresolved review threads.
   */
  countUnresolvedThreads(owner: string, repo: string, prNumber: number): Promise<number>;

  /**
   * Fetches the list of commits in a PR.
   */
  fetchPullRequestCommits(owner: string, repo: string, prNumber: number): Promise<Commit[]>;

  /**
   * Performs the merge operation.
   */
  mergePullRequest(
    owner: string,
    repo: string,
    prNumber: number,
    method: 'squash' | 'merge',
    sha: string,
    commitTitle: string,
    commitMessage: string,
  ): Promise<MergeOperationResult>;
}

/**
 * Port for logging operations.
 * The infra layer will implement this interface using @actions/core or console.
 */
export interface ILogger {
  info(message: string): void;
  warning(message: string): void;
  error(message: string): void;
}

/**
 * Port for time operations (for testing retry delays).
 */
export interface ITimeProvider {
  waitMs(ms: number): Promise<void>;
}

// ============================================================================
// APPLICATION SERVICES
// ============================================================================

/**
 * Dependencies for the merge application service.
 */
export interface MergeAppDependencies {
  githubRepo: IGitHubRepository;
  logger: ILogger;
  timeProvider: ITimeProvider;
}

/**
 * Parameters for executing the merge operation.
 */
export interface ExecuteMergeParams {
  context: EventContext;
  config: ActionConfig;
  mergeOptions: MergeOptions;
}

/**
 * Application service for orchestrating merge operations.
 * This contains the business workflow logic.
 */
export class MergeAppService {
  constructor(private readonly deps: MergeAppDependencies) {}

  /**
   * Executes the merge operation.
   * This is the main orchestration function.
   */
  async execute(params: ExecuteMergeParams): Promise<Result<MergeResult, string>> {
    const { context, config, mergeOptions } = params;
    const { githubRepo, logger, timeProvider } = this.deps;
    const { owner, repo, prNumber, commentId } = context;

    // Import domain functions dynamically to avoid circular dependencies
    const {
      isBot,
      parseCommand,
      hasValidAuthorAssociation,
      hasValidPermission,
      validatePRState,
      determineMergeMethod,
      getMergeableStateDescription,
      buildCheckResultsMarkdown,
      isConventionalCommitTitle,
    } = await import('./domain.js');

    // -------------------------------------------------------------------------
    // Step 1: Validate event type and context
    // -------------------------------------------------------------------------

    // Validate event type
    if (context.eventName !== 'issue_comment') {
      return { ok: true, value: { status: 'skipped', message: 'This action only runs on issue_comment events' } };
    }

    // Check if this is a PR comment
    if (!context.isPullRequest) {
      return { ok: true, value: { status: 'skipped', message: 'Comment is not on a PR, skipping' } };
    }

    // Skip if bot
    if (isBot(context.userType)) {
      return { ok: true, value: { status: 'skipped', message: 'Comment is from a bot' } };
    }

    // Validate command (should already be validated by caller, but double-check)
    const commandCheck = parseCommand(context.commentBody);
    if (!commandCheck) {
      return { ok: true, value: { status: 'skipped', message: 'Command not matched' } };
    }

    // Add eyes reaction for immediate feedback
    await githubRepo.addReaction(owner, repo, commentId, 'eyes');

    // -------------------------------------------------------------------------
    // Step 2: Validate user permissions
    // -------------------------------------------------------------------------

    // Check author association
    if (!hasValidAuthorAssociation(context.authorAssociation)) {
      await githubRepo.postComment(
        owner,
        repo,
        prNumber,
        `## Permission denied\n\n> [!CAUTION]\n> Only repository owners, members, and collaborators can use the \`/lysbot merge\` command.\n>\n> Your association: \`${context.authorAssociation}\``,
      );
      return { ok: true, value: { status: 'failed', message: 'Invalid author association' } };
    }

    // Check permission level
    const permission = await githubRepo.getCollaboratorPermission(owner, repo, context.actor);
    if (!hasValidPermission(permission)) {
      await githubRepo.postComment(
        owner,
        repo,
        prNumber,
        `## Permission denied\n\n> [!CAUTION]\n> You need at least **write** permission on this repository to use the \`/lysbot merge\` command.\n>\n> Your association: \`${context.authorAssociation}\`\n> Your permission level: \`${permission}\``,
      );
      return { ok: true, value: { status: 'failed', message: 'Insufficient permissions' } };
    }

    // -------------------------------------------------------------------------
    // Step 3: Fetch and validate PR data
    // -------------------------------------------------------------------------

    let prData = await githubRepo.fetchPullRequestData(owner, repo, prNumber);

    // Check for fork PR
    if (prData.isFork) {
      await githubRepo.postComment(
        owner,
        repo,
        prNumber,
        '## Fork PR not supported\n\n> [!WARNING]\n> The `/lysbot merge` command is not supported for PRs from forked repositories.\n>\n> This is because the GITHUB_TOKEN has limited write permissions for fork-originated PRs by default.',
      );
      return { ok: true, value: { status: 'failed', message: 'Fork PR not supported' } };
    }

    // Check if already merged
    if (prData.merged) {
      await githubRepo.postComment(
        owner,
        repo,
        prNumber,
        '## Already merged\n\nThis PR has already been merged.',
      );
      return { ok: true, value: { status: 'already_merged', message: 'PR already merged' } };
    }

    // PR state checks
    const prStateChecks = validatePRState(prData);

    // Unresolved threads check
    const unresolvedCount = await githubRepo.countUnresolvedThreads(owner, repo, prNumber);
    const threadsCheck: CheckResult = {
      name: 'All review conversations are resolved',
      passed: unresolvedCount === 0,
      ...(unresolvedCount > 0 && { details: `${unresolvedCount} unresolved` }),
    };

    // Approval check
    const approvedReviews = await githubRepo.fetchApprovedReviews(owner, repo, prNumber);
    let validApprovals = 0;
    const dismissFailures: string[] = [];

    for (const review of approvedReviews) {
      // Skip self-approval
      if (review.user?.login === prData.author) {
        continue;
      }

      // Check if review is stale
      if (review.commit_id !== prData.headSha) {
        const message = `Approval dismissed: New commits were pushed after this review was submitted (reviewed commit: ${review.commit_id?.slice(0, 7)}, current HEAD: ${prData.headSha.slice(0, 7)}).`;
        const dismissed = await githubRepo.dismissReview(owner, repo, prNumber, review.id, message);
        if (!dismissed) {
          dismissFailures.push(
            `- Failed to dismiss approval from @${review.user?.login} (insufficient permissions or branch protection settings)`,
          );
        }
      } else {
        validApprovals++;
      }
    }

    // Post stale dismissal notification
    if (dismissFailures.length > 0) {
      const staleComment = `## Stale approval dismiss failures\n\n> [!WARNING]\n> The following approvals could not be dismissed (consider enabling "Dismiss stale pull request approvals when new commits are pushed" in branch protection settings):\n>\n${dismissFailures.map((f) => `> ${f}`).join('\n')}`;
      await githubRepo.postComment(owner, repo, prNumber, staleComment);
    }

    // Determine approval status
    const approvalCheckPassed = validApprovals >= 1;
    const approvalOverridden = mergeOptions.overrideApprovalRequirement && !approvalCheckPassed;

    if (approvalOverridden) {
      logger.info('Approval requirement overridden by command flag (--override-approval-requirement).');
    }

    // Build approval check result
    let approvalDetails: string | undefined;
    if (approvalCheckPassed) {
      approvalDetails = undefined;
    } else if (approvalOverridden) {
      approvalDetails = 'approval requirement overridden by `--override-approval-requirement`; no valid approvals found';
    } else {
      approvalDetails = 'no valid approvals found';
    }

    const approvalCheck: CheckResult = {
      name: 'At least one valid approval from another user',
      passed: approvalCheckPassed,
      ...(approvalDetails !== undefined && { details: approvalDetails }),
      ...(approvalOverridden && { optional: true }),
    };

    // Merge conflicts check
    const noConflicts = prData.mergeableState === 'clean';
    const conflictsCheck: CheckResult = {
      name: 'No merge conflicts',
      passed: noConflicts,
      ...(!noConflicts && { details: getMergeableStateDescription(prData.mergeableState) }),
    };

    // Conventional Commits check
    const isConventionalTitle = isConventionalCommitTitle(prData.title);
    const conventionalCommitsCheck: CheckResult = {
      name: 'PR title follows [Conventional Commits](https://www.conventionalcommits.org/)',
      passed: isConventionalTitle,
      ...(!isConventionalTitle && { details: 'title does not follow conventional format' }),
      optional: true,
    };

    // Determine merge method
    const mergeMethodResult = determineMergeMethod(prData.headRef, prData.baseRef, config);

    // Build checks array
    const checks: CheckResult[] = [
      ...prStateChecks,
      threadsCheck,
      approvalCheck,
      conflictsCheck,
      conventionalCommitsCheck,
    ];

    // Build results markdown
    const checksMarkdown = buildCheckResultsMarkdown(checks);
    const allPassed = checks.filter((c) => !c.optional).every((c) => c.passed);

    // -------------------------------------------------------------------------
    // Step 4: Report results and merge if all passed
    // -------------------------------------------------------------------------

    if (!allPassed) {
      await githubRepo.postComment(
        owner,
        repo,
        prNumber,
        `## Merge checks failed\n\nThe following checks must pass before merging:\n\n${checksMarkdown}\n\n### Merge Method\n\n- **Method:** \`${mergeMethodResult.method}\`\n- **Reason:** ${mergeMethodResult.reason}`,
      );
      return { ok: true, value: { status: 'failed', message: 'Merge checks failed' } };
    }

    // All checks passed
    await githubRepo.postComment(
      owner,
      repo,
      prNumber,
      `## Merge checks passed\n\nAll checks passed. Proceeding to merge...\n\n${checksMarkdown}\n\n### Merge Method\n\n- **Method:** \`${mergeMethodResult.method}\`\n- **Reason:** ${mergeMethodResult.reason}`,
    );

    // -------------------------------------------------------------------------
    // Step 5: TOCTOU check and merge
    // -------------------------------------------------------------------------

    const originalHeadSha = prData.headSha;

    // Re-fetch PR data for TOCTOU check
    prData = await githubRepo.fetchPullRequestData(owner, repo, prNumber);

    if (prData.headSha !== originalHeadSha) {
      await githubRepo.postComment(
        owner,
        repo,
        prNumber,
        `## New commits detected\n\n> [!WARNING]\n> New commits were pushed while validating this PR.\n>\n> - Original HEAD SHA: ${originalHeadSha}\n> - Current HEAD SHA: ${prData.headSha}\n>\n> Please run \`/lysbot merge\` again after the new commits are reviewed and approved.`,
      );
      return { ok: true, value: { status: 'failed', message: 'TOCTOU violation' } };
    }

    // Retry loop for mergeable status
    let retries = 0;
    while (prData.mergeable === null && retries < config.mergeableRetryCount) {
      await timeProvider.waitMs(config.mergeableRetryInterval * 1000);
      prData = await githubRepo.fetchPullRequestData(owner, repo, prNumber);
      retries++;

      // TOCTOU check during retry
      if (prData.headSha !== originalHeadSha) {
        await githubRepo.postComment(
          owner,
          repo,
          prNumber,
          `## New commits detected\n\n> [!WARNING]\n> New commits were pushed while validating this PR (after waiting for mergeable status).\n>\n> - Original HEAD SHA: ${originalHeadSha}\n> - Current HEAD SHA: ${prData.headSha}\n>\n> Please run \`/lysbot merge\` again after the new commits are reviewed and approved.`,
        );
        return { ok: true, value: { status: 'failed', message: 'TOCTOU violation during retry' } };
      }
    }

    // Check final mergeability
    if (prData.mergeable === false || prData.mergeable === null || prData.mergeableState === 'dirty') {
      let errorComment: string;
      if (prData.mergeable === null) {
        errorComment = `## Mergeability status pending\n\n> [!NOTE]\n> GitHub is still calculating mergeability for this PR.\n>\n> - Mergeable: \`null\`\n> - Mergeable State: \`${prData.mergeableState}\`\n> - Retries: count=${config.mergeableRetryCount}, interval=${config.mergeableRetryInterval}s\n>\n> Please try \`/lysbot merge\` again shortly.`;
      } else if (prData.mergeableState === 'dirty') {
        errorComment = `## Conflicts detected\n\n> [!CAUTION]\n> This PR has merge conflicts that must be resolved before merging.\n>\n> - Mergeable: \`${prData.mergeable}\`\n> - Mergeable State: \`${prData.mergeableState}\`\n>\n> Please resolve the conflicts and try again.`;
      } else {
        errorComment = `## Cannot merge\n\n> [!CAUTION]\n> This PR cannot be merged:\n>\n> - Mergeable: \`${prData.mergeable}\`\n> - Mergeable State: \`${prData.mergeableState}\`\n>\n> Please resolve any conflicts or issues before attempting to merge.`;
      }
      await githubRepo.postComment(owner, repo, prNumber, errorComment);
      return { ok: true, value: { status: 'failed', message: 'Not mergeable' } };
    }

    // Build commit title and message
    let commitTitle: string;
    let commitBody: string;

    let additionalMessages = `Merged-by: lysbot-merge (on behalf of @${context.actor})`;
    if (approvalOverridden) {
      additionalMessages += `\n\n⚠️ EXCEPTIONAL MERGE: Approval requirement overridden via --override-approval-requirement`;
    }

    if (mergeMethodResult.method === 'merge') {
      commitTitle = `Merge pull request #${prNumber} from ${prData.headRef}`;
      commitBody = `${prData.title}\n\n${additionalMessages}`;
    } else {
      commitTitle = `${prData.title} (#${prNumber})`;

      const commits = await githubRepo.fetchPullRequestCommits(owner, repo, prNumber);
      const commitTitles = commits
        .map((c) => {
          const message = c.commit.message || '';
          const firstLine = message.split('\n')[0];
          return firstLine ? `* ${firstLine}` : '';
        })
        .filter((title) => title !== '');

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

    // Perform merge
    const mergeResult = await githubRepo.mergePullRequest(
      owner,
      repo,
      prNumber,
      mergeMethodResult.method,
      originalHeadSha,
      commitTitle,
      commitBody,
    );

    if (!mergeResult.success) {
      await githubRepo.postComment(
        owner,
        repo,
        prNumber,
        `## Merge failed\n\n> [!CAUTION]\n> Failed to merge PR:\n>\n> - Error: ${mergeResult.error}\n>\n> Please check the PR status and try again.`,
      );
      return { ok: true, value: { status: 'failed', message: `Merge failed: ${mergeResult.error}` } };
    }

    // Post success comment
    let mergeCommitInfo = '';
    if (mergeResult.mergeCommitSha) {
      mergeCommitInfo = `\n- **Merge Commit SHA:** ${mergeResult.mergeCommitSha}`;
    }

    await githubRepo.postComment(
      owner,
      repo,
      prNumber,
      `## Merged by lysbot-merge\n\nThis PR has been successfully merged.\n\n### Details\n\n- **Merge Method:** \`${mergeMethodResult.method}\`\n- **Base Branch:** \`${prData.baseRef}\`\n- **Head Branch:** \`${prData.headRef}\`\n- **HEAD SHA:** ${originalHeadSha}${mergeCommitInfo}`,
    );

    return {
      ok: true,
      value: {
        status: 'merged',
        message: 'PR merged successfully',
        mergeMethod: mergeMethodResult.method,
      },
    };
  }
}
