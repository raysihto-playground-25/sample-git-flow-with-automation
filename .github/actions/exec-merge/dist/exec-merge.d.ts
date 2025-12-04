/**
 * exec-merge.ts - Core logic for automated PR merging
 *
 * FLOW OVERVIEW:
 * 1. Command validation - Check if comment is "/exec merge" (skip bots)
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
import type { GitHub } from '@actions/github/lib/utils';
import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
/**
 * Configuration options for the exec-merge action.
 * These are passed from the workflow inputs.
 */
export interface ExecMergeConfig {
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
}
/**
 * Merge method and reason.
 */
export interface MergeMethodResult {
    method: 'squash' | 'merge';
    reason: string;
}
/**
 * Overall result of the exec-merge operation.
 */
export interface ExecMergeResult {
    /** Final status of the operation */
    status: 'merged' | 'skipped' | 'failed' | 'already_merged';
    /** Detailed message about what happened */
    message: string;
    /** Merge method used (if merged) */
    mergeMethod?: 'squash' | 'merge';
}
export type Octokit = InstanceType<typeof GitHub>;
/**
 * Command regex for matching `/exec merge` comments.
 * Uses simple regex pattern compatible with JavaScript.
 */
export declare const COMMAND_REGEX: RegExp;
/**
 * Twemoji images for cross-browser emoji compatibility.
 * https://github.com/twitter/twemoji (CC-BY 4.0 licensed)
 */
export declare const TWEMOJI: {
    readonly CHECK: "<img src=\"https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/2705.svg\" width=\"20\" height=\"20\" alt=\"OK\">";
    readonly CROSS: "<img src=\"https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/274c.svg\" width=\"20\" height=\"20\" alt=\"NG\">";
};
/**
 * Valid author associations that can use the /exec merge command.
 * Why: Only trusted users with write access should be able to trigger merges.
 * OWNER/MEMBER have org-level trust, COLLABORATOR has explicit repo access.
 * CONTRIBUTOR and others may have submitted PRs but lack merge authority.
 */
export declare const VALID_AUTHOR_ASSOCIATIONS: readonly ["OWNER", "MEMBER", "COLLABORATOR"];
/**
 * Valid permission levels that can use the /exec merge command.
 * Why: Maps to GitHub's permission model - admin/maintain/write can merge PRs.
 * Read-only users should not be able to trigger merges even if they can comment.
 */
export declare const VALID_PERMISSIONS: readonly ["admin", "maintain", "write"];
/**
 * Checks if a comment matches the `/exec merge` command pattern.
 *
 * @param commentBody - The body of the comment to check
 * @returns true if the comment is the exec merge command
 *
 * @example
 * isExecMergeCommand('/exec merge')     // true
 * isExecMergeCommand('  /exec merge  ') // true
 * isExecMergeCommand('/exec merge now') // false
 */
export declare function isExecMergeCommand(commentBody: string): boolean;
/**
 * Checks if the user type indicates a bot.
 *
 * @param userType - The type of user from GitHub API
 * @returns true if the user is a bot
 */
export declare function isBot(userType: string): boolean;
/**
 * Checks if the author association is valid for using the merge command.
 *
 * @param association - The author_association from GitHub API
 * @returns true if the association allows merge command usage
 */
export declare function hasValidAuthorAssociation(association: string): boolean;
/**
 * Checks if the permission level allows merge command usage.
 *
 * @param permission - The permission level from GitHub API
 * @returns true if the permission level is sufficient
 */
export declare function hasValidPermission(permission: string): boolean;
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
export declare function determineMergeMethod(headRef: string, baseRef: string, config: ExecMergeConfig): MergeMethodResult;
/**
 * Validates the PR state for merging.
 *
 * @param prData - Pull request data from GitHub API
 * @returns Array of check results
 */
export declare function validatePRState(prData: PullRequestData): CheckResult[];
/**
 * Generates a human-readable description for a mergeable state.
 *
 * @param state - The mergeable_state from GitHub API
 * @returns Human-readable description
 */
export declare function getMergeableStateDescription(state: string): string;
/**
 * Builds the check results markdown for PR comments.
 *
 * @param checks - Array of check results
 * @returns Formatted markdown string
 */
export declare function buildCheckResultsMarkdown(checks: CheckResult[]): string;
/**
 * Sleeps for a specified number of milliseconds.
 * Used for retry intervals when waiting for mergeable status.
 *
 * @param ms - Milliseconds to sleep
 */
export declare function sleep(ms: number): Promise<void>;
/**
 * Adds a reaction to a comment.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param commentId - Comment ID
 * @param reaction - Reaction to add
 */
export declare function addReaction(octokit: Octokit, owner: string, repo: string, commentId: number, reaction: '+1' | '-1' | 'laugh' | 'confused' | 'heart' | 'hooray' | 'rocket' | 'eyes'): Promise<void>;
/**
 * Posts a comment on a PR.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - PR number
 * @param body - Comment body
 */
export declare function postComment(octokit: Octokit, owner: string, repo: string, prNumber: number, body: string): Promise<void>;
/**
 * Gets the collaborator permission level for a user.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param username - Username to check
 * @returns Permission level or 'none' on failure
 */
export declare function getCollaboratorPermission(octokit: Octokit, owner: string, repo: string, username: string): Promise<string>;
/**
 * Fetches PR data from GitHub API.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - PR number
 * @returns Pull request data
 */
export declare function fetchPullRequestData(octokit: Octokit, owner: string, repo: string, prNumber: number): Promise<PullRequestData>;
/**
 * Fetches all approved reviews for a PR.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - PR number
 * @returns Array of approved reviews
 */
export declare function fetchApprovedReviews(octokit: Octokit, owner: string, repo: string, prNumber: number): Promise<RestEndpointMethodTypes['pulls']['listReviews']['response']['data']>;
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
export declare function dismissReview(octokit: Octokit, owner: string, repo: string, prNumber: number, reviewId: number, message: string): Promise<boolean>;
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
export declare function countUnresolvedThreads(octokit: Octokit, owner: string, repo: string, prNumber: number): Promise<number>;
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
 * @returns true if merge succeeded
 */
export declare function mergePullRequest(octokit: Octokit, owner: string, repo: string, prNumber: number, method: 'squash' | 'merge', sha: string, commitMessage: string): Promise<{
    success: boolean;
    error?: string;
}>;
/**
 * Main function that orchestrates the exec-merge operation.
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
export declare function execMerge(octokit: Octokit, context: EventContext, config: ExecMergeConfig): Promise<ExecMergeResult>;
