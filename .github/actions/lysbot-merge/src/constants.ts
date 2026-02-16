/**
 * constants.ts - Constants and configuration values for lysbot-merge
 *
 * This module contains all constant values, regex patterns, and configuration
 * data used throughout the lysbot-merge action.
 */

/**
 * Regex to detect a bot-style command at the start of the comment body (e.g. /lysbot, /xybot).
 * Only space and tab are allowed before the trigger; leading newlines are not accepted.
 * Used to add :eyes: reaction first and to decide whether to post an invalid-command comment.
 * Pattern: optional space/tab, slash, 2–5 characters, then "bot".
 */
export const BOT_TRIGGER_REGEX = /^[ \t]*\/.{2,5}bot/;

/**
 * Command regex for matching `/lysbot merge` at the start of the comment body.
 * Only space and tab are allowed before the command and between tokens; leading or trailing newlines are not accepted.
 * Captures optional flags after the merge command (same line only).
 * Pattern: optional space/tab, "/lysbot", one or more space/tab, "merge", optional space/tab + rest of line.
 */
export const COMMAND_REGEX = /^[ \t]*\/lysbot[ \t]+merge(?:[ \t]+([^\n]*))?[ \t]*$/;

/**
 * List of valid command flags for `/lysbot merge`.
 */
export const VALID_FLAGS = ['--override-approval-requirement'] as const;

/**
 * Valid author associations that can use the /lysbot merge command.
 * Why: Only trusted users with write access should be able to trigger merges.
 * OWNER/MEMBER have org-level trust, COLLABORATOR has explicit repo access.
 * CONTRIBUTOR and others may have submitted PRs but lack merge authority.
 * 
 * Note: Command actors must pass BOTH author association and permission checks.
 * Reviewers are validated using permission level only (see VALID_PERMISSIONS).
 */
export const VALID_AUTHOR_ASSOCIATIONS = ['OWNER', 'MEMBER', 'COLLABORATOR'] as const;

/**
 * Valid permission levels that can use the /lysbot merge command.
 * Why: Maps to GitHub's permission model - admin/maintain/write can merge PRs.
 * Read-only users should not be able to trigger merges even if they can comment.
 * 
 * Note: This check is used for both command actors (with author association check)
 * and reviewers (permission-only check, as GitHub App tokens may return 'NONE'
 * for author_association even for valid collaborators).
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
