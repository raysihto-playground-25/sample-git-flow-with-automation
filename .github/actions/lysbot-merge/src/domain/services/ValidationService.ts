/**
 * ValidationService - Domain service for validation operations
 *
 * This service contains pure business logic for validating commands,
 * permissions, and PR states. It has no dependencies on external infrastructure.
 */

import {
  COMMAND_REGEX,
  VALID_FLAGS,
  VALID_AUTHOR_ASSOCIATIONS,
  VALID_PERMISSIONS,
  CONVENTIONAL_COMMIT_REGEX,
} from '../constants.js';
import type { MergeOptions } from '../value-objects/MergeOptions.js';
import type { PullRequest } from '../entities/PullRequest.js';
import type { MergeCheckResult } from '../entities/MergeCheckResult.js';

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
 * Parses the `/lysbot merge` command and extracts options.
 *
 * @param commentBody - The body of the comment containing the command
 * @returns MergeOptions with parsed flags, or null if not a valid command
 *
 * @example
 * parseCommand('/lysbot merge')
 *   // { overrideApprovalRequirement: false }
 * parseCommand('/lysbot merge --override-approval-requirement')
 *   // { overrideApprovalRequirement: true }
 * parseCommand('hello')
 *   // null
 */
export function parseCommand(commentBody: string): MergeOptions | null {
  const match = COMMAND_REGEX.exec(commentBody);
  if (!match) {
    return null;
  }

  // Parse and validate flags
  const flagsStr = match[1]?.trim() ?? '';
  const flags = flagsStr ? flagsStr.split(/\s+/) : [];

  // Validate that all flags are known
  const validFlagsArray: readonly string[] = VALID_FLAGS;
  if (!flags.every((flag) => validFlagsArray.includes(flag))) {
    return null;
  }

  return {
    overrideApprovalRequirement: flags.includes('--override-approval-requirement'),
  };
}

/**
 * Checks if a comment matches the `/lysbot merge` command pattern.
 * Now also accepts optional flags like `--override-approval-requirement`.
 *
 * @param commentBody - The body of the comment to check
 * @returns true if the comment is the merge command
 *
 * @example
 * isCommand('/lysbot merge')     // true
 * isCommand('  /lysbot merge  ') // true
 * isCommand('/lysbot merge --override-approval-requirement') // true
 * isCommand('/lysbot merge now') // false (invalid flag)
 */
export function isCommand(commentBody: string): boolean {
  return parseCommand(commentBody) !== null;
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
 * Validates the PR state for merging.
 *
 * @param pr - Pull request entity
 * @returns Array of check results
 */
export function validatePRState(pr: PullRequest): MergeCheckResult[] {
  const checks: MergeCheckResult[] = [];

  // Consolidated check: PR is ready for review (combines open, unlocked, and not draft checks)
  const isOpen = pr.state === 'open';
  const isUnlocked = !pr.locked;
  const isNotDraft = !pr.draft;
  const allPassed = isOpen && isUnlocked && isNotDraft;

  // Collect failure reasons
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
 * Waits for a specified number of milliseconds before retrying.
 * This is a custom utility function specific to lysbot-merge action,
 * used for retry intervals when waiting for mergeable status.
 *
 * @param ms - Milliseconds to wait
 */
export function waitBeforeRetryMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
