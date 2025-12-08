/**
 * validation.ts - Pure validation and business logic functions
 *
 * This module contains all pure functions for validation, formatting,
 * and business logic that don't require external I/O operations.
 * These functions are easily testable and have no side effects.
 */
import type { LysbotMergeConfig, PullRequestData, CheckResult, MergeMethodResult, MergeOptions } from './types';
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
export declare function isConventionalCommitTitle(title: string): boolean;
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
export declare function parseLysbotMergeCommand(commentBody: string): MergeOptions | null;
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
export declare function isLysbotMergeCommand(commentBody: string): boolean;
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
export declare function determineMergeMethod(headRef: string, baseRef: string, config: LysbotMergeConfig): MergeMethodResult;
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
 * Waits for a specified number of milliseconds before retrying.
 * This is a custom utility function specific to lysbot-merge action,
 * used for retry intervals when waiting for mergeable status.
 *
 * @param ms - Milliseconds to wait
 */
export declare function waitBeforeRetryMs(ms: number): Promise<void>;
