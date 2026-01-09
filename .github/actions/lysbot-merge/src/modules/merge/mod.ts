/**
 * modules/merge/mod.ts - Lysbot-merge feature module
 *
 * This module implements the PR merge automation feature following the
 * Lightweight Modular Monolith architecture with strict section contracts.
 *
 * Architecture: Each section is clearly marked and follows specific rules:
 * - DOMAIN: Pure functions only, no I/O, no classes
 * - APP: Orchestration and port definitions
 * - INFRA: Port implementations using @actions/* and Node.js APIs
 */

import * as core from '@actions/core';

import {
  COMMAND_REGEX,
  VALID_FLAGS,
  TWEMOJI,
  VALID_AUTHOR_ASSOCIATIONS,
  VALID_PERMISSIONS,
  CONVENTIONAL_COMMIT_REGEX,
} from '../../shared/kernel/constants.js';
import type {
  ActionConfig,
  EventContext,
  ActionResult,
  CheckResult,
  MergeMethodResult,
  MergeOptions,
  Octokit,
  PullRequestData,
  ReviewsArray,
} from '../../shared/kernel/types.js';

// ============================================================================
// [SECTION: DOMAIN] - Pure Logic
// ============================================================================
// Rules:
// - Only pure functions, types, interfaces, and constants
// - No classes, no process.env, no Date.now(), no Math.random()
// - No @actions/* imports or any I/O operations
// - All external dependencies passed as function arguments
// ============================================================================

/**
 * Checks if a PR title follows the Conventional Commits format.
 */
export function isConventionalCommitTitle(title: string): boolean {
  return CONVENTIONAL_COMMIT_REGEX.test(title);
}

/**
 * Parses the `/lysbot merge` command and extracts options.
 */
export function parseCommand(commentBody: string): MergeOptions | null {
  const match = COMMAND_REGEX.exec(commentBody);
  if (!match) {
    return null;
  }

  const flagsStr = match[1]?.trim() ?? '';
  const flags = flagsStr ? flagsStr.split(/\s+/) : [];

  const validFlagsArray: readonly string[] = VALID_FLAGS;
  if (!flags.every((flag) => validFlagsArray.includes(flag))) {
    return null;
  }

  return {
    overrideApprovalRequirement: flags.includes('--override-approval-requirement'),
  };
}

/**
 * Checks if the user type indicates a bot.
 */
export function isBot(userType: string): boolean {
  return userType === 'Bot';
}

/**
 * Checks if the author association is valid for using the merge command.
 */
export function hasValidAuthorAssociation(association: string): boolean {
  return (VALID_AUTHOR_ASSOCIATIONS as readonly string[]).includes(association);
}

/**
 * Checks if the permission level allows merge command usage.
 */
export function hasValidPermission(permission: string): boolean {
  return (VALID_PERMISSIONS as readonly string[]).includes(permission);
}

/**
 * Determines the merge method based on branch names.
 */
export function determineMergeMethod(headRef: string, baseRef: string, config: ActionConfig): MergeMethodResult {
  if (headRef.startsWith(config.releaseBranchPrefix)) {
    return {
      method: 'merge',
      reason: `Head branch \`${headRef}\` is a release branch (merge commit to preserve release history)`,
    };
  }
  if (headRef.startsWith(config.syncBranchPrefix)) {
    return {
      method: 'merge',
      reason: `Head branch \`${headRef}\` is a sync branch (merge commit to preserve back-merge history)`,
    };
  }

  if (baseRef.startsWith(config.releaseBranchPrefix)) {
    return {
      method: 'squash',
      reason: `Base branch \`${baseRef}\` is a release branch`,
    };
  }
  if (baseRef === config.developBranch) {
    return {
      method: 'squash',
      reason: `Base branch is \`${baseRef}\``,
    };
  }

  return {
    method: 'merge',
    reason: `Default merge commit for \`${headRef}\` into \`${baseRef}\``,
  };
}

/**
 * Validates the PR state for merging.
 */
export function validatePRState(prData: PullRequestData): CheckResult[] {
  const checks: CheckResult[] = [];

  const isOpen = prData.state === 'open';
  const isUnlocked = !prData.locked;
  const isNotDraft = !prData.draft;
  const allPassed = isOpen && isUnlocked && isNotDraft;

  const failureReasons: string[] = [];
  if (!isOpen) {
    failureReasons.push('currently closed');
  }
  if (!isUnlocked) {
    failureReasons.push('currently locked');
  }
  if (!isNotDraft) {
    failureReasons.push('currently a draft');
  }

  checks.push({
    name: 'PR is ready for review',
    passed: allPassed,
    ...(failureReasons.length > 0 && { details: failureReasons.join(', ') }),
  });

  return checks;
}

/**
 * Generates a human-readable description for a mergeable state.
 */
export function getMergeableStateDescription(state: string): string {
  const descriptions: Record<string, string> = {
    dirty: 'has unresolved conflicts',
    blocked: 'blocked by status checks or branch protection',
    unstable: 'has failing status checks',
    behind: 'branch is behind base branch',
    unknown: 'mergeability not yet computed, please retry',
    has_hooks: 'blocked by external hooks',
    clean: 'ready to merge',
  };
  return descriptions[state] ?? `mergeable_state: ${state}`;
}

/**
 * Builds the check results markdown for PR comments.
 */
export function buildCheckResultsMarkdown(checks: CheckResult[]): string {
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
 * Builds a summary markdown table for the lysbot-merge operation.
 */
export function buildSummaryMarkdown(result: string, prNumber: number, actor: string, mergeMethod?: string): string {
  let summary = `## lysbot-merge Summary\n\n`;
  summary += `| Item | Value |\n`;
  summary += `|------|-------|\n`;
  summary += `| **Result** | ${result} |\n`;
  summary += `| **PR** | #${prNumber} |\n`;
  summary += `| **Triggered by** | @${actor} |\n`;

  if (mergeMethod) {
    summary += `| **Merge Method** | \`${mergeMethod}\` |\n`;
  }

  return summary;
}

// ============================================================================
// [SECTION: APP] - Orchestration & Ports
// ============================================================================
// Rules:
// - Define workflow orchestration logic
// - Define port interfaces (small, task-specific)
// - Map domain results to output types
// - No direct I/O implementation here
// ============================================================================

/**
 * Port: GitHub operations for merge workflow
 */
export interface GitHubPort {
  addReaction(
    commentId: number,
    reaction: '+1' | '-1' | 'laugh' | 'confused' | 'heart' | 'hooray' | 'rocket' | 'eyes',
  ): Promise<void>;
  postComment(prNumber: number, body: string): Promise<void>;
  getCollaboratorPermission(username: string): Promise<string>;
  fetchPullRequestData(prNumber: number): Promise<PullRequestData>;
  fetchApprovedReviews(prNumber: number): Promise<ReviewsArray>;
  dismissReview(prNumber: number, reviewId: number, message: string): Promise<boolean>;
  countUnresolvedThreads(prNumber: number): Promise<number>;
  fetchPullRequestCommits(
    prNumber: number,
  ): Promise<Array<{ commit: { message: string; author?: { name?: string; email?: string } | null } }>>;
  mergePullRequest(
    prNumber: number,
    method: 'squash' | 'merge',
    sha: string,
    commitTitle: string,
    commitMessage: string,
  ): Promise<{ success: boolean; error?: string; mergeCommitSha?: string }>;
}

/**
 * Port: Time operations for testing
 */
export interface TimePort {
  wait(ms: number): Promise<void>;
}

/**
 * Port: Logging operations
 */
export interface LogPort {
  info(message: string): void;
}

/**
 * Main orchestration function for the merge workflow.
 * This implements the APP layer logic using ports for all I/O operations.
 */
export async function executeAction(
  github: GitHubPort,
  time: TimePort,
  log: LogPort,
  context: EventContext,
  config: ActionConfig,
): Promise<ActionResult> {
  const { prNumber, commentId, commentBody, actor, userType, authorAssociation, eventName, isPullRequest } = context;

  // Step 1: Validate event type and context
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

  await github.addReaction(commentId, 'eyes');

  if (!hasValidAuthorAssociation(authorAssociation)) {
    await github.postComment(
      prNumber,
      `## Permission denied\n\n> [!CAUTION]\n> Only repository owners, members, and collaborators can use the \`/lysbot merge\` command.\n>\n> Your association: \`${authorAssociation}\``,
    );
    return { status: 'failed', message: 'Invalid author association' };
  }

  const permission = await github.getCollaboratorPermission(actor);
  if (!hasValidPermission(permission)) {
    await github.postComment(
      prNumber,
      `## Permission denied\n\n> [!CAUTION]\n> You need at least **write** permission on this repository to use the \`/lysbot merge\` command.\n>\n> Your association: \`${authorAssociation}\`\n> Your permission level: \`${permission}\``,
    );
    return { status: 'failed', message: 'Insufficient permissions' };
  }

  // Step 2: Fetch and validate PR data
  let prData = await github.fetchPullRequestData(prNumber);

  if (prData.isFork) {
    await github.postComment(
      prNumber,
      '## Fork PR not supported\n\n> [!WARNING]\n> The `/lysbot merge` command is not supported for PRs from forked repositories.\n>\n> This is because the GITHUB_TOKEN has limited write permissions for fork-originated PRs by default.',
    );
    return { status: 'failed', message: 'Fork PR not supported' };
  }

  if (prData.merged) {
    await github.postComment(prNumber, '## Already merged\n\nThis PR has already been merged.');
    return { status: 'already_merged', message: 'PR already merged' };
  }

  // Step 3: Run checks
  const prStateChecks = validatePRState(prData);

  const unresolvedCount = await github.countUnresolvedThreads(prNumber);
  const threadsCheck: CheckResult = {
    name: 'All review conversations are resolved',
    passed: unresolvedCount === 0,
    ...(unresolvedCount > 0 && { details: `${unresolvedCount} unresolved` }),
  };

  const approvedReviews = await github.fetchApprovedReviews(prNumber);
  let validApprovals = 0;
  const dismissFailures: string[] = [];

  for (const review of approvedReviews) {
    if (review.user?.login === prData.author) {
      continue;
    }

    if (review.commit_id !== prData.headSha) {
      const message = `Approval dismissed: New commits were pushed after this review was submitted (reviewed commit: ${review.commit_id?.slice(0, 7)}, current HEAD: ${prData.headSha.slice(0, 7)}).`;
      const dismissed = await github.dismissReview(prNumber, review.id, message);
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
    await github.postComment(prNumber, staleComment);
  }

  const approvalCheckPassed = validApprovals >= 1;
  const approvalOverridden = mergeOptions.overrideApprovalRequirement && !approvalCheckPassed;

  if (approvalOverridden) {
    log.info('Approval requirement overridden by command flag (--override-approval-requirement).');
  }

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

  const noConflicts = prData.mergeableState === 'clean';
  const conflictsCheck: CheckResult = {
    name: 'No merge conflicts',
    passed: noConflicts,
    ...(!noConflicts && { details: getMergeableStateDescription(prData.mergeableState) }),
  };

  const isConventionalTitle = isConventionalCommitTitle(prData.title);
  const conventionalCommitsCheck: CheckResult = {
    name: 'PR title follows [Conventional Commits](https://www.conventionalcommits.org/)',
    passed: isConventionalTitle,
    ...(!isConventionalTitle && { details: 'title does not follow conventional format' }),
    optional: true,
  };

  const mergeMethodResult = determineMergeMethod(prData.headRef, prData.baseRef, config);

  const checks: CheckResult[] = [
    ...prStateChecks,
    threadsCheck,
    approvalCheck,
    conflictsCheck,
    conventionalCommitsCheck,
  ];

  const checksMarkdown = buildCheckResultsMarkdown(checks);
  const allPassed = checks.filter((c) => !c.optional).every((c) => c.passed);

  // Step 4: Report results and merge if all passed
  if (!allPassed) {
    await github.postComment(
      prNumber,
      `## Merge checks failed\n\nThe following checks must pass before merging:\n\n${checksMarkdown}\n\n### Merge Method\n\n- **Method:** \`${mergeMethodResult.method}\`\n- **Reason:** ${mergeMethodResult.reason}`,
    );
    return { status: 'failed', message: 'Merge checks failed' };
  }

  await github.postComment(
    prNumber,
    `## Merge checks passed\n\nAll checks passed. Proceeding to merge...\n\n${checksMarkdown}\n\n### Merge Method\n\n- **Method:** \`${mergeMethodResult.method}\`\n- **Reason:** ${mergeMethodResult.reason}`,
  );

  // Step 5: TOCTOU check and merge
  const originalHeadSha = prData.headSha;

  prData = await github.fetchPullRequestData(prNumber);

  if (prData.headSha !== originalHeadSha) {
    await github.postComment(
      prNumber,
      `## New commits detected\n\n> [!WARNING]\n> New commits were pushed while validating this PR.\n>\n> - Original HEAD SHA: ${originalHeadSha}\n> - Current HEAD SHA: ${prData.headSha}\n>\n> Please run \`/lysbot merge\` again after the new commits are reviewed and approved.`,
    );
    return { status: 'failed', message: 'TOCTOU violation' };
  }

  let retries = 0;
  while (prData.mergeable === null && retries < config.mergeableRetryCount) {
    await time.wait(config.mergeableRetryInterval * 1000);
    prData = await github.fetchPullRequestData(prNumber);
    retries++;

    if (prData.headSha !== originalHeadSha) {
      await github.postComment(
        prNumber,
        `## New commits detected\n\n> [!WARNING]\n> New commits were pushed while validating this PR (after waiting for mergeable status).\n>\n> - Original HEAD SHA: ${originalHeadSha}\n> - Current HEAD SHA: ${prData.headSha}\n>\n> Please run \`/lysbot merge\` again after the new commits are reviewed and approved.`,
      );
      return { status: 'failed', message: 'TOCTOU violation during retry' };
    }
  }

  if (prData.mergeable === false || prData.mergeable === null || prData.mergeableState === 'dirty') {
    let errorComment: string;
    if (prData.mergeable === null) {
      errorComment = `## Mergeability status pending\n\n> [!NOTE]\n> GitHub is still calculating mergeability for this PR.\n>\n> - Mergeable: \`null\`\n> - Mergeable State: \`${prData.mergeableState}\`\n> - Retries: count=${config.mergeableRetryCount}, interval=${config.mergeableRetryInterval}s\n>\n> Please try \`/lysbot merge\` again shortly.`;
    } else if (prData.mergeableState === 'dirty') {
      errorComment = `## Conflicts detected\n\n> [!CAUTION]\n> This PR has merge conflicts that must be resolved before merging.\n>\n> - Mergeable: \`${prData.mergeable}\`\n> - Mergeable State: \`${prData.mergeableState}\`\n>\n> Please resolve the conflicts and try again.`;
    } else {
      errorComment = `## Cannot merge\n\n> [!CAUTION]\n> This PR cannot be merged:\n>\n> - Mergeable: \`${prData.mergeable}\`\n> - Mergeable State: \`${prData.mergeableState}\`\n>\n> Please resolve any conflicts or issues before attempting to merge.`;
    }
    await github.postComment(prNumber, errorComment);
    return { status: 'failed', message: 'Not mergeable' };
  }

  // Build commit message
  let commitTitle: string;
  let commitBody: string;

  let additionalMessages = `Merged-by: lysbot-merge (on behalf of @${actor})`;
  if (approvalOverridden) {
    additionalMessages += `\n\n⚠️ EXCEPTIONAL MERGE: Approval requirement overridden via --override-approval-requirement`;
  }

  if (mergeMethodResult.method === 'merge') {
    commitTitle = `Merge pull request #${prNumber} from ${prData.headRef}`;
    commitBody = `${prData.title}\n\n${additionalMessages}`;
  } else {
    commitTitle = `${prData.title} (#${prNumber})`;

    const commits = await github.fetchPullRequestCommits(prNumber);
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

  const mergeResult = await github.mergePullRequest(
    prNumber,
    mergeMethodResult.method,
    originalHeadSha,
    commitTitle,
    commitBody,
  );

  if (!mergeResult.success) {
    await github.postComment(
      prNumber,
      `## Merge failed\n\n> [!CAUTION]\n> Failed to merge PR:\n>\n> - Error: ${mergeResult.error}\n>\n> Please check the PR status and try again.`,
    );
    return { status: 'failed', message: `Merge failed: ${mergeResult.error}` };
  }

  let mergeCommitInfo = '';
  if (mergeResult.mergeCommitSha) {
    mergeCommitInfo = `\n- **Merge Commit SHA:** ${mergeResult.mergeCommitSha}`;
  }

  await github.postComment(
    prNumber,
    `## Merged by lysbot-merge\n\nThis PR has been successfully merged.\n\n### Details\n\n- **Merge Method:** \`${mergeMethodResult.method}\`\n- **Base Branch:** \`${prData.baseRef}\`\n- **Head Branch:** \`${prData.headRef}\`\n- **HEAD SHA:** ${originalHeadSha}${mergeCommitInfo}`,
  );

  return {
    status: 'merged',
    message: 'PR merged successfully',
    mergeMethod: mergeMethodResult.method,
  };
}

// ============================================================================
// [SECTION: INFRA] - Port Implementations
// ============================================================================
// Rules:
// - Implements port interfaces defined in APP section
// - Uses @actions/* libraries and Node.js APIs
// - Handles all I/O operations
// ============================================================================

/**
 * GitHub port implementation using Octokit
 */
export class OctokitGitHubAdapter implements GitHubPort {
  constructor(
    private octokit: Octokit,
    private owner: string,
    private repo: string,
  ) {}

  async addReaction(
    commentId: number,
    reaction: '+1' | '-1' | 'laugh' | 'confused' | 'heart' | 'hooray' | 'rocket' | 'eyes',
  ): Promise<void> {
    try {
      await this.octokit.rest.reactions.createForIssueComment({
        owner: this.owner,
        repo: this.repo,
        comment_id: commentId,
        content: reaction,
      });
    } catch {
      // Silently fail - reaction may already exist
    }
  }

  async postComment(prNumber: number, body: string): Promise<void> {
    await this.octokit.rest.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: prNumber,
      body,
    });
  }

  async getCollaboratorPermission(username: string): Promise<string> {
    try {
      const response = await this.octokit.rest.repos.getCollaboratorPermissionLevel({
        owner: this.owner,
        repo: this.repo,
        username,
      });
      return response.data.permission;
    } catch {
      return 'none';
    }
  }

  async fetchPullRequestData(prNumber: number): Promise<PullRequestData> {
    const response = await this.octokit.rest.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });
    const pr = response.data;

    const isFork = pr.head.repo?.fork === true || pr.head.repo?.owner?.id !== pr.base.repo?.owner?.id;

    return {
      state: pr.state,
      locked: pr.locked,
      draft: pr.draft ?? false,
      merged: pr.merged,
      mergeable: pr.mergeable,
      mergeableState: pr.mergeable_state,
      headSha: pr.head.sha,
      headRef: pr.head.ref,
      baseRef: pr.base.ref,
      author: pr.user?.login ?? 'unknown',
      isFork,
      title: pr.title,
    };
  }

  async fetchApprovedReviews(prNumber: number): Promise<ReviewsArray> {
    const reviews = await this.octokit.paginate(this.octokit.rest.pulls.listReviews, {
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      per_page: 100,
    });
    return reviews.filter((review) => review.state === 'APPROVED');
  }

  async dismissReview(prNumber: number, reviewId: number, message: string): Promise<boolean> {
    try {
      await this.octokit.rest.pulls.dismissReview({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        review_id: reviewId,
        message,
      });
      return true;
    } catch {
      return false;
    }
  }

  async countUnresolvedThreads(prNumber: number): Promise<number> {
    let unresolvedCount = 0;
    let hasNextPage = true;
    let cursor: string | null = null;

    const query = `
      query($owner: String!, $name: String!, $number: Int!, $cursor: String) {
        repository(owner: $owner, name: $name) {
          pullRequest(number: $number) {
            reviewThreads(first: 100, after: $cursor) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                isResolved
              }
            }
          }
        }
      }
    `;

    while (hasNextPage) {
      const response: {
        repository: {
          pullRequest: {
            reviewThreads: {
              pageInfo: { hasNextPage: boolean; endCursor: string | null };
              nodes: Array<{ isResolved: boolean }>;
            };
          };
        };
      } = await this.octokit.graphql(query, {
        owner: this.owner,
        name: this.repo,
        number: prNumber,
        cursor,
      });

      const threads = response.repository.pullRequest.reviewThreads;
      unresolvedCount += threads.nodes.filter((n) => !n.isResolved).length;
      hasNextPage = threads.pageInfo.hasNextPage;
      cursor = threads.pageInfo.endCursor;
    }

    return unresolvedCount;
  }

  async fetchPullRequestCommits(
    prNumber: number,
  ): Promise<Array<{ commit: { message: string; author?: { name?: string; email?: string } | null } }>> {
    const commits = await this.octokit.paginate(this.octokit.rest.pulls.listCommits, {
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      per_page: 100,
    });
    return commits;
  }

  async mergePullRequest(
    prNumber: number,
    method: 'squash' | 'merge',
    sha: string,
    commitTitle: string,
    commitMessage: string,
  ): Promise<{ success: boolean; error?: string; mergeCommitSha?: string }> {
    try {
      const response = await this.octokit.rest.pulls.merge({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        merge_method: method,
        sha,
        commit_title: commitTitle,
        commit_message: commitMessage,
      });
      return { success: true, mergeCommitSha: response.data.sha };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }
}

/**
 * Time port implementation using Node.js setTimeout
 */
export class NodeTimeAdapter implements TimePort {
  async wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Log port implementation using @actions/core
 */
export class CoreLogAdapter implements LogPort {
  info(message: string): void {
    core.info(message);
  }
}
