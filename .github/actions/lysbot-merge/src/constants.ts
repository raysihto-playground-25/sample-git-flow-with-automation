/**
 * constants.ts - Constants and configuration values for lysbot-merge
 *
 * This module contains all constant values, regex patterns, and configuration
 * data used throughout the lysbot-merge action.
 */

/**
 * Command regex for matching `/lysbot merge` comments.
 * Captures optional flags after the merge command.
 * Uses simple regex pattern compatible with JavaScript.
 */
export const COMMAND_REGEX = /^\s*\/lysbot\s+merge(?:\s+(.*))?\s*$/;

/**
 * List of valid command flags for `/lysbot merge`.
 */
export const VALID_FLAGS = ['--override-approval-requirement'] as const;

/**
 * Emoji characters for status display.
 */
export const EMOJI = {
  CHECK: '✅',
  CROSS: '❌',
  WARNING: '⚠️',
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
