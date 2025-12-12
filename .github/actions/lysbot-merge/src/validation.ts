/**
 * validation.ts - Pure validation and business logic functions
 *
 * This module contains all pure functions for validation, formatting,
 * and business logic that don't require external I/O operations.
 * These functions are easily testable and have no side effects.
 */

import type { ActionConfig, PullRequestData, CheckResult, MergeMethodResult, MergeOptions } from './types.js';
import {
  COMMAND_REGEX,
  VALID_FLAGS,
  TWEMOJI,
  VALID_AUTHOR_ASSOCIATIONS,
  VALID_PERMISSIONS,
  CONVENTIONAL_COMMIT_REGEX,
} from './constants.js';

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
  if (!match) return null;

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
export function determineMergeMethod(headRef: string, baseRef: string, config: ActionConfig): MergeMethodResult {
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

  // Consolidated check: PR is ready for review (combines open, unlocked, and not draft checks)
  const isOpen = prData.state === 'open';
  const isUnlocked = !prData.locked;
  const isNotDraft = !prData.draft;
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
    details: failureReasons.length > 0 ? failureReasons.join(', ') : undefined,
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
