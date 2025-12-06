/**
 * lysbot-merge.ts - Core logic for automated PR merging
 *
 * FLOW OVERVIEW:
 * 1. Command validation - Check if comment is "/lysbot merge" (skip bots)
 * 2. Permission check - Verify OWNER/MEMBER/COLLABORATOR + write permission
 * 3. PR state check - Ensure PR is open, unlocked, not draft, not from fork
 * 4. Review check - Dismiss stale approvals, require 1+ valid approval
 * 5. Thread check - Ensure all review conversations are resolved
 * 6. Mergeability check - Wait for GitHub to compute, verify no conflicts
 * 7. TOCTOU check - Re-verify HEAD SHA hasn't changed before merge
 * 8. Execute merge - Use squash or merge commit based on branch patterns
 *
 * The code is structured to be easily testable by:
 * - Separating pure logic functions from I/O operations
 * - Using dependency injection for GitHub API calls
 * - Using TypeScript interfaces for type safety
 *
 * THIRD-PARTY LICENSES:
 * - Twemoji graphics (https://github.com/twitter/twemoji) are used for emoji
 *   display compatibility. Licensed under CC-BY 4.0.
 *   Copyright 2020 Twitter, Inc and other contributors
 */

import * as core from '@actions/core';
import type { GitHub } from '@actions/github/lib/utils';
import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';

// =============================================================================
// Types and Interfaces
// =============================================================================

/**
 * Configuration options for the lysbot-merge action.
 * These are passed from the workflow inputs.
 */
export interface LysbotMergeConfig {
  /** Prefix for release branches (e.g., "release/") */
  releaseBranchPrefix: string;
  /** Name of the develop branch */
  developBranch: string;
  /** Prefix for sync branches used in back-merges */
  syncBranchPrefix: string;
  /** Number of retries for mergeable status calculation */
  mergeableRetryCount: number;
  /** Interval in seconds between retries */
  mergeableRetryInterval: number;
}

/**
 * Context from the GitHub event that triggered this action.
 */
export interface EventContext {
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** PR number */
  prNumber: number;
  /** Comment ID that triggered the action */
  commentId: number;
  /** Comment body text */
  commentBody: string;
  /** User who made the comment */
  actor: string;
  /** Type of user (User, Bot, etc.) */
  userType: string;
  /** Author association with the repository */
  authorAssociation: string;
  /** Server URL for building links */
  serverUrl: string;
  /** Workflow run ID */
  runId: number;
}

/**
 * Pull request data fetched from GitHub API.
 */
export interface PullRequestData {
  state: string;
  locked: boolean;
  draft: boolean;
  merged: boolean;
  mergeable: boolean | null;
  mergeableState: string;
  headSha: string;
  headRef: string;
  baseRef: string;
  author: string;
  isFork: boolean;
  title: string;
}

/**
 * Result of validation checks.
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Reason for failure (if any) */
  reason?: string;
  /** User-friendly message to post as comment */
  message?: string;
}

/**
 * Individual check result for the merge checklist.
 */
export interface CheckResult {
  name: string;
  passed: boolean;
  details?: string;
  /** If true, this check does not block the merge even when it fails */
  optional?: boolean;
}

/**
 * Merge method and reason.
 */
export interface MergeMethodResult {
  method: 'squash' | 'merge';
  reason: string;
}

/**
 * Overall result of the lysbot-merge operation.
 */
export interface LysbotMergeResult {
  /** Final status of the operation */
  status: 'merged' | 'skipped' | 'failed' | 'already_merged';
  /** Detailed message about what happened */
  message: string;
  /** Merge method used (if merged) */
  mergeMethod?: 'squash' | 'merge';
}

// Type alias for Octokit instance
export type Octokit = InstanceType<typeof GitHub>;

// =============================================================================
// Constants
// =============================================================================

/**
 * Command regex for matching `/lysbot merge` comments.
 * Captures optional flags after the merge command.
 * Uses simple regex pattern compatible with JavaScript.
 */
export const COMMAND_REGEX = /^\s*\/lysbot\s+merge(?:\s+(.*))?\s*$/;

/**
 * Options parsed from the `/lysbot merge` command.
 */
export interface MergeOptions {
  /**
   * When true, skip the "sufficient approvals" requirement.
   * All other checks (status checks, merge conflicts, labels, etc.) still apply.
   */
  overrideApprovalRequirement: boolean;
}

/**
 * Twemoji images for cross-browser emoji compatibility.
 * https://github.com/twitter/twemoji (CC-BY 4.0 licensed)
 */
export const TWEMOJI = {
  CHECK:
    '<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/2705.svg" width="20" height="20" alt="OK">',
  CROSS:
    '<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/274c.svg" width="20" height="20" alt="NG">',
  WARNING:
    '<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/26a0.svg" width="20" height="20" alt="Warning">',
} as const;

/**
 * Valid author associations that can use the /lysbot merge command.
 * Why: Only trusted users with write access should be able to trigger merges.
 * OWNER/MEMBER have org-level trust, COLLABORATOR has explicit repo access.
 * CONTRIBUTOR and others may have submitted PRs but lack merge authority.
 */
export const VALID_AUTHOR_ASSOCIATIONS = ['OWNER', 'MEMBER', 'COLLABORATOR'] as const;

/**
 * Valid permission levels that can use the /lysbot merge command.
 * Why: Maps to GitHub's permission model - admin/maintain/write can merge PRs.
 * Read-only users should not be able to trigger merges even if they can comment.
 */
export const VALID_PERMISSIONS = ['admin', 'maintain', 'write'] as const;

/**
 * Valid Conventional Commits types for PR title validation.
 * See https://www.conventionalcommits.org/
 *
 * Note: `ux` is a project-specific additional custom type for user experience improvements.
 */
export const CONVENTIONAL_COMMIT_TYPES = [
  'build',
  'chore',
  'ci',
  'docs',
  'feat',
  'fix',
  'perf',
  'refactor',
  'revert',
  'style',
  'test',
  'ux', // project-specific additional custom type
] as const;

/**
 * Regex pattern for validating Conventional Commits format.
 * Format: <type>(<optional scope>): <description>
 * The description must contain at least one non-whitespace character.
 * Examples:
 * - feat: add new feature
 * - fix(auth): resolve login issue
 * - docs(readme): update installation guide
 */
export const CONVENTIONAL_COMMIT_REGEX = new RegExp(
  `^(${CONVENTIONAL_COMMIT_TYPES.join('|')})(\\([^)!]+\\))?!?:\\s*\\S.*$`,
);

// =============================================================================
// Pure Logic Functions (easily testable)
// =============================================================================

/**
 * Checks if a PR title follows the Conventional Commits format.
 *
 * @param title - The PR title to validate
 * @returns true if the title follows Conventional Commits format
 *
 * @example
 * isConventionalCommitTitle('feat: add new feature')           // true
 * isConventionalCommitTitle('fix(auth): resolve login issue')  // true
 * isConventionalCommitTitle('Update README')                   // false
 */
export function isConventionalCommitTitle(title: string): boolean {
  return CONVENTIONAL_COMMIT_REGEX.test(title);
}

/**
 * Checks if a comment matches the `/lysbot merge` command pattern.
 * Now also accepts optional flags like `--override-approval-requirement`.
 *
 * @param commentBody - The body of the comment to check
 * @returns true if the comment is the lysbot merge command
 *
 * @example
 * isLysbotMergeCommand('/lysbot merge')     // true
 * isLysbotMergeCommand('  /lysbot merge  ') // true
 * isLysbotMergeCommand('/lysbot merge --override-approval-requirement') // true
 * isLysbotMergeCommand('/lysbot merge now') // false (invalid flag)
 */
export function isLysbotMergeCommand(commentBody: string): boolean {
  const match = COMMAND_REGEX.exec(commentBody);
  if (!match) return false;

  // If there are flags, validate them
  const flagsStr = match[1]?.trim();
  if (flagsStr) {
    // Only allow known flags
    const validFlags = ['--override-approval-requirement'];
    const flags = flagsStr.split(/\s+/);
    return flags.every((flag) => validFlags.includes(flag));
  }

  return true;
}

/**
 * Parses the `/lysbot merge` command and extracts options.
 *
 * @param commentBody - The body of the comment containing the command
 * @returns MergeOptions with parsed flags, or null if not a valid command
 *
 * @example
 * parseLysbotMergeCommand('/lysbot merge')
 *   // { overrideApprovalRequirement: false }
 * parseLysbotMergeCommand('/lysbot merge --override-approval-requirement')
 *   // { overrideApprovalRequirement: true }
 * parseLysbotMergeCommand('hello')
 *   // null
 */
export function parseLysbotMergeCommand(commentBody: string): MergeOptions | null {
  if (!isLysbotMergeCommand(commentBody)) {
    return null;
  }

  const match = COMMAND_REGEX.exec(commentBody);
  const flagsStr = match?.[1]?.trim() ?? '';
  const flags = flagsStr ? flagsStr.split(/\s+/) : [];

  return {
    overrideApprovalRequirement: flags.includes('--override-approval-requirement'),
  };
}

/**
 * Checks if the user type indicates a bot.
 *
 * @param userType - The type of user from GitHub API
 * @returns true if the user is a bot
 */
export function isBot(userType: string): boolean {
  return userType === 'Bot';
}

/**
 * Checks if the author association is valid for using the merge command.
 *
 * @param association - The author_association from GitHub API
 * @returns true if the association allows merge command usage
 */
export function hasValidAuthorAssociation(association: string): boolean {
  return (VALID_AUTHOR_ASSOCIATIONS as readonly string[]).includes(association);
}

/**
 * Checks if the permission level allows merge command usage.
 *
 * @param permission - The permission level from GitHub API
 * @returns true if the permission level is sufficient
 */
export function hasValidPermission(permission: string): boolean {
  return (VALID_PERMISSIONS as readonly string[]).includes(permission);
}

/**
 * Determines the merge method based on branch names.
 *
 * Logic:
 * 1. If head branch starts with release prefix → merge (preserve release history)
 * 2. If head branch starts with sync prefix → merge (preserve back-merge history)
 * 3. If base branch starts with release prefix → squash (clean release branch)
 * 4. If base branch is develop → squash (clean develop branch)
 * 5. Otherwise → merge (default)
 *
 * @param headRef - Head (source) branch name
 * @param baseRef - Base (target) branch name
 * @param config - Configuration with branch prefixes
 * @returns The merge method and reason
 */
export function determineMergeMethod(headRef: string, baseRef: string, config: LysbotMergeConfig): MergeMethodResult {
  // Check head branch patterns first
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

  // Check base branch patterns
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

  // Default to merge commit
  return {
    method: 'merge',
    reason: `Default merge commit for \`${headRef}\` into \`${baseRef}\``,
  };
}

/**
 * Validates the PR state for merging.
 *
 * @param prData - Pull request data from GitHub API
 * @returns Array of check results
 */
export function validatePRState(prData: PullRequestData): CheckResult[] {
  const checks: CheckResult[] = [];

  // Check 1: PR is open
  checks.push({
    name: 'PR is open',
    passed: prData.state === 'open',
    details: prData.state !== 'open' ? 'currently closed' : undefined,
  });

  // Check 2: PR is unlocked
  checks.push({
    name: 'PR is unlocked',
    passed: !prData.locked,
    details: prData.locked ? 'currently locked' : undefined,
  });

  // Check 3: PR is not a draft
  checks.push({
    name: 'PR is ready for review',
    passed: !prData.draft,
    details: prData.draft ? 'currently a draft' : undefined,
  });

  return checks;
}

/**
 * Generates a human-readable description for a mergeable state.
 *
 * @param state - The mergeable_state from GitHub API
 * @returns Human-readable description
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
 *
 * @param checks - Array of check results
 * @returns Formatted markdown string
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
 * Waits for a specified number of milliseconds before retrying.
 * This is a custom utility function specific to lysbot-merge action,
 * used for retry intervals when waiting for mergeable status.
 *
 * @param ms - Milliseconds to wait
 */
export function waitBeforeRetryMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// GitHub API Functions (require Octokit instance)
// =============================================================================

/**
 * Adds a reaction to a comment.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param commentId - Comment ID
 * @param reaction - Reaction to add
 */
export async function addReaction(
  octokit: Octokit,
  owner: string,
  repo: string,
  commentId: number,
  reaction: '+1' | '-1' | 'laugh' | 'confused' | 'heart' | 'hooray' | 'rocket' | 'eyes',
): Promise<void> {
  try {
    await octokit.rest.reactions.createForIssueComment({
      owner,
      repo,
      comment_id: commentId,
      content: reaction,
    });
  } catch {
    // Silently fail - reaction may already exist
  }
}

/**
 * Posts a comment on a PR.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - PR number
 * @param body - Comment body
 */
export async function postComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  body: string,
): Promise<void> {
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });
}

/**
 * Gets the collaborator permission level for a user.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param username - Username to check
 * @returns Permission level or 'none' on failure
 */
export async function getCollaboratorPermission(
  octokit: Octokit,
  owner: string,
  repo: string,
  username: string,
): Promise<string> {
  try {
    const response = await octokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username,
    });
    return response.data.permission;
  } catch {
    return 'none';
  }
}

/**
 * Fetches PR data from GitHub API.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - PR number
 * @returns Pull request data
 */
export async function fetchPullRequestData(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PullRequestData> {
  const response = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });
  const pr = response.data;

  // Detect fork using robust logic: check fork flag OR compare owner IDs
  // This handles cases where head.repo is null (e.g., fork repo deleted)
  const isFork = pr.head.repo?.fork === true || (pr.head.repo?.owner?.id ?? 0) !== (pr.base.repo?.owner?.id ?? 0);

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

/**
 * Fetches all approved reviews for a PR.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - PR number
 * @returns Array of approved reviews
 */
export async function fetchApprovedReviews(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<RestEndpointMethodTypes['pulls']['listReviews']['response']['data']> {
  const reviews = await octokit.paginate(octokit.rest.pulls.listReviews, {
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });
  return reviews.filter((review) => review.state === 'APPROVED');
}

/**
 * Dismisses a stale review.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - PR number
 * @param reviewId - Review ID to dismiss
 * @param message - Dismissal message
 * @returns true if dismissed successfully
 */
export async function dismissReview(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  reviewId: number,
  message: string,
): Promise<boolean> {
  try {
    await octokit.rest.pulls.dismissReview({
      owner,
      repo,
      pull_number: prNumber,
      review_id: reviewId,
      message,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Counts unresolved review threads using GraphQL.
 * Why: REST API doesn't provide review thread resolution status, GraphQL is required.
 * Note: Counts ALL unresolved threads including outdated ones, matching GitHub's
 * "Require conversations to be resolved" branch protection behavior.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - PR number
 * @returns Number of unresolved threads
 */
export async function countUnresolvedThreads(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<number> {
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
    } = await octokit.graphql(query, {
      owner,
      name: repo,
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

/**
 * Performs the merge operation.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - PR number
 * @param method - Merge method (squash or merge)
 * @param sha - Expected head SHA for TOCTOU check
 * @param commitMessage - Additional commit message
 * @returns Object containing success status, error message, and merge commit SHA
 */
export async function mergePullRequest(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  method: 'squash' | 'merge',
  sha: string,
  commitMessage: string,
): Promise<{ success: boolean; error?: string; mergeCommitSha?: string }> {
  try {
    const response = await octokit.rest.pulls.merge({
      owner,
      repo,
      pull_number: prNumber,
      merge_method: method,
      sha,
      commit_message: commitMessage,
    });
    return { success: true, mergeCommitSha: response.data.sha };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

// =============================================================================
// Main Orchestration Function
// =============================================================================

/**
 * Main function that orchestrates the lysbot-merge operation.
 *
 * This function:
 * 1. Validates the command and permissions
 * 2. Checks PR state and approval status
 * 3. Performs the merge if all checks pass
 * 4. Posts appropriate comments for feedback
 *
 * @param octokit - GitHub API client
 * @param context - Event context from GitHub Actions
 * @param config - Configuration options
 * @returns Result of the operation
 */
export async function lysbotMerge(
  octokit: Octokit,
  context: EventContext,
  config: LysbotMergeConfig,
): Promise<LysbotMergeResult> {
  const { owner, repo, prNumber, commentId, commentBody, actor, userType, authorAssociation } = context;

  // -------------------------------------------------------------------------
  // Step 1: Validate command and user
  // -------------------------------------------------------------------------

  // Skip if bot
  if (isBot(userType)) {
    return { status: 'skipped', message: 'Comment is from a bot' };
  }

  // Check if this is the lysbot merge command
  if (!isLysbotMergeCommand(commentBody)) {
    return { status: 'skipped', message: 'Command not matched' };
  }

  // Parse merge options from the command
  const mergeOptions = parseLysbotMergeCommand(commentBody);
  if (!mergeOptions) {
    return { status: 'skipped', message: 'Command not matched' };
  }

  // Add eyes reaction for immediate feedback
  await addReaction(octokit, owner, repo, commentId, 'eyes');

  // Check author association
  if (!hasValidAuthorAssociation(authorAssociation)) {
    await postComment(
      octokit,
      owner,
      repo,
      prNumber,
      `## Permission denied\n\nOnly repository owners, members, and collaborators can use the \`/lysbot merge\` command.\n\nYour association: \`${authorAssociation}\``,
    );
    return { status: 'failed', message: 'Invalid author association' };
  }

  // Check permission level
  const permission = await getCollaboratorPermission(octokit, owner, repo, actor);
  if (!hasValidPermission(permission)) {
    await postComment(
      octokit,
      owner,
      repo,
      prNumber,
      `## Permission denied\n\nYou need at least **write** permission on this repository to use the \`/lysbot merge\` command.\n\nYour association: \`${authorAssociation}\`\nYour permission level: \`${permission}\``,
    );
    return { status: 'failed', message: 'Insufficient permissions' };
  }

  // -------------------------------------------------------------------------
  // Step 2: Fetch and validate PR data
  // -------------------------------------------------------------------------

  let prData = await fetchPullRequestData(octokit, owner, repo, prNumber);

  // Why: GITHUB_TOKEN has limited write permissions for fork PRs by default.
  // Merge operations would fail, so we reject early with a clear message.
  if (prData.isFork) {
    await postComment(
      octokit,
      owner,
      repo,
      prNumber,
      '## Fork PR not supported\n\nThe `/lysbot merge` command is not supported for PRs from forked repositories.\n\nThis is because the GITHUB_TOKEN has limited write permissions for fork-originated PRs by default.',
    );
    return { status: 'failed', message: 'Fork PR not supported' };
  }

  // Check if already merged
  if (prData.merged) {
    await postComment(octokit, owner, repo, prNumber, '## Already merged\n\nThis PR has already been merged.');
    return { status: 'already_merged', message: 'PR already merged' };
  }

  // -------------------------------------------------------------------------
  // Step 3: Run all validation checks
  // -------------------------------------------------------------------------

  const checks: CheckResult[] = [];

  // PR state checks
  checks.push(...validatePRState(prData));

  // Approval check - fetch and validate reviews
  const approvedReviews = await fetchApprovedReviews(octokit, owner, repo, prNumber);
  let validApprovals = 0;
  const dismissFailures: string[] = [];

  for (const review of approvedReviews) {
    // Skip self-approval
    if (review.user?.login === prData.author) {
      continue;
    }

    // Check if review is stale (not on current HEAD)
    if (review.commit_id !== prData.headSha) {
      const message = `Approval dismissed: New commits were pushed after this review was submitted (reviewed commit: ${review.commit_id?.slice(0, 7)}, current HEAD: ${prData.headSha.slice(0, 7)}).`;
      const dismissed = await dismissReview(octokit, owner, repo, prNumber, review.id, message);
      if (!dismissed) {
        dismissFailures.push(
          `- Failed to dismiss approval from @${review.user?.login} (insufficient permissions or branch protection settings)`,
        );
      }
    } else {
      validApprovals++;
    }
  }

  // Post stale dismissal notification only when there are failures.
  // Success notifications are skipped because GitHub's native "approval dismissed"
  // notification already appears in the PR timeline when reviews are dismissed.
  if (dismissFailures.length > 0) {
    const staleComment = `## Stale approval dismiss failures\n\nThe following approvals could not be dismissed (consider enabling "Dismiss stale pull request approvals when new commits are pushed" in branch protection settings):\n\n${dismissFailures.join('\n')}`;
    await postComment(octokit, owner, repo, prNumber, staleComment);
  }

  // Determine if approval requirement is overridden
  const approvalCheckPassed = validApprovals >= 1;
  const approvalOverridden = mergeOptions.overrideApprovalRequirement && !approvalCheckPassed;

  // Log when approval requirement is overridden
  if (approvalOverridden) {
    core.info('Approval requirement overridden by command flag (--override-approval-requirement).');
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

  checks.push({
    name: 'At least one valid approval from another user',
    passed: approvalCheckPassed,
    details: approvalDetails,
    // Mark as optional when override flag is used, so it shows warning instead of failure
    optional: approvalOverridden,
  });

  // Unresolved threads check
  const unresolvedCount = await countUnresolvedThreads(octokit, owner, repo, prNumber);
  checks.push({
    name: 'All review conversations are resolved',
    passed: unresolvedCount === 0,
    details: unresolvedCount > 0 ? `${unresolvedCount} unresolved` : undefined,
  });

  // Merge conflicts check (based on mergeable_state)
  const noConflicts = prData.mergeableState === 'clean';
  checks.push({
    name: 'No merge conflicts',
    passed: noConflicts,
    details: !noConflicts ? getMergeableStateDescription(prData.mergeableState) : undefined,
  });

  // Optional: Conventional Commits check for PR title
  const isConventionalTitle = isConventionalCommitTitle(prData.title);
  checks.push({
    name: 'PR title follows [Conventional Commits](https://www.conventionalcommits.org/)',
    passed: isConventionalTitle,
    details: !isConventionalTitle ? 'title does not follow conventional format' : undefined,
    optional: true,
  });

  // Determine merge method
  const mergeMethodResult = determineMergeMethod(prData.headRef, prData.baseRef, config);

  // Build results markdown
  // Reorder checks to match workflow order: open, unlocked, ready, threads, approval, conflicts, optional checks
  const orderedChecks = [
    checks.find((c) => c.name === 'PR is open')!,
    checks.find((c) => c.name === 'PR is unlocked')!,
    checks.find((c) => c.name === 'PR is ready for review')!,
    checks.find((c) => c.name === 'All review conversations are resolved')!,
    checks.find((c) => c.name === 'At least one valid approval from another user')!,
    checks.find((c) => c.name === 'No merge conflicts')!,
    checks.find((c) => c.name.includes('Conventional Commits'))!,
  ];
  const checksMarkdown = buildCheckResultsMarkdown(orderedChecks);
  // Only required (non-optional) checks must pass
  const allPassed = orderedChecks.filter((c) => !c.optional).every((c) => c.passed);

  // -------------------------------------------------------------------------
  // Step 4: Report results and merge if all passed
  // -------------------------------------------------------------------------

  if (!allPassed) {
    await postComment(
      octokit,
      owner,
      repo,
      prNumber,
      `## Merge checks failed\n\nThe following checks must pass before merging:\n\n${checksMarkdown}\n\n### Merge Method\n\n- **Method:** \`${mergeMethodResult.method}\`\n- **Reason:** ${mergeMethodResult.reason}`,
    );
    return { status: 'failed', message: 'Merge checks failed' };
  }

  // All checks passed - post status and proceed to merge
  await postComment(
    octokit,
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
  prData = await fetchPullRequestData(octokit, owner, repo, prNumber);

  if (prData.headSha !== originalHeadSha) {
    await postComment(
      octokit,
      owner,
      repo,
      prNumber,
      `## New commits detected\n\nNew commits were pushed while validating this PR.\n\n- Original HEAD SHA: ${originalHeadSha}\n- Current HEAD SHA: ${prData.headSha}\n\nPlease run \`/lysbot merge\` again after the new commits are reviewed and approved.`,
    );
    return { status: 'failed', message: 'TOCTOU violation' };
  }

  // Why: GitHub API returns mergeable=null while computing merge status asynchronously.
  // This typically happens on first fetch after PR update. We retry to wait for computation.
  let retries = 0;
  while (prData.mergeable === null && retries < config.mergeableRetryCount) {
    await waitBeforeRetryMs(config.mergeableRetryInterval * 1000);
    prData = await fetchPullRequestData(octokit, owner, repo, prNumber);
    retries++;

    // TOCTOU check during retry
    if (prData.headSha !== originalHeadSha) {
      await postComment(
        octokit,
        owner,
        repo,
        prNumber,
        `## New commits detected\n\nNew commits were pushed while validating this PR (after waiting for mergeable status).\n\n- Original HEAD SHA: ${originalHeadSha}\n- Current HEAD SHA: ${prData.headSha}\n\nPlease run \`/lysbot merge\` again after the new commits are reviewed and approved.`,
      );
      return { status: 'failed', message: 'TOCTOU violation during retry' };
    }
  }

  // Check final mergeability
  if (prData.mergeable === false || prData.mergeable === null || prData.mergeableState === 'dirty') {
    let errorComment: string;
    if (prData.mergeable === null) {
      errorComment = `## Mergeability status pending\n\nGitHub is still calculating mergeability for this PR.\n\n- Mergeable: \`null\`\n- Mergeable State: \`${prData.mergeableState}\`\n- Retries: count=${config.mergeableRetryCount}, interval=${config.mergeableRetryInterval}s\n\nPlease try \`/lysbot merge\` again shortly.`;
    } else if (prData.mergeableState === 'dirty') {
      errorComment = `## Conflicts detected\n\nThis PR has merge conflicts that must be resolved before merging.\n\n- Mergeable: \`${prData.mergeable}\`\n- Mergeable State: \`${prData.mergeableState}\`\n\nPlease resolve the conflicts and try again.`;
    } else {
      errorComment = `## Cannot merge\n\nThis PR cannot be merged:\n\n- Mergeable: \`${prData.mergeable}\`\n- Mergeable State: \`${prData.mergeableState}\`\n\nPlease resolve any conflicts or issues before attempting to merge.`;
    }
    await postComment(octokit, owner, repo, prNumber, errorComment);
    return { status: 'failed', message: 'Not mergeable' };
  }

  // Perform merge
  const commitMessage = `Merged-by: lysbot-merge (on behalf of @${actor})`;
  const mergeResult = await mergePullRequest(
    octokit,
    owner,
    repo,
    prNumber,
    mergeMethodResult.method,
    originalHeadSha,
    commitMessage,
  );

  if (!mergeResult.success) {
    await postComment(
      octokit,
      owner,
      repo,
      prNumber,
      `## Merge failed\n\nFailed to merge PR:\n\n- Error: ${mergeResult.error}\n\nPlease check the PR status and try again.`,
    );
    return { status: 'failed', message: `Merge failed: ${mergeResult.error}` };
  }

  // Post success comment with commit SHAs (GitHub auto-links them)
  let mergeCommitInfo = '';
  if (mergeResult.mergeCommitSha) {
    mergeCommitInfo = `\n- **Merge Commit SHA:** ${mergeResult.mergeCommitSha}`;
  }

  await postComment(
    octokit,
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
