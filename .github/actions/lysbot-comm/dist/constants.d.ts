/**
 * constants.ts - Constants and configuration values for lysbot-comm
 *
 * This module contains all constant values, regex patterns, and configuration
 * data used throughout the lysbot-comm action.
 */
/**
 * Command regex for matching `/lysbot merge` comments.
 * Captures optional flags after the merge command.
 * Uses simple regex pattern compatible with JavaScript.
 */
export declare const COMMAND_REGEX: RegExp;
/**
 * List of valid command flags for `/lysbot merge`.
 */
export declare const VALID_FLAGS: readonly ["--override-approval-requirement"];
/**
 * Twemoji images for cross-browser emoji compatibility.
 * https://github.com/twitter/twemoji (CC-BY 4.0 licensed)
 */
export declare const TWEMOJI: {
    readonly CHECK: "<img src=\"https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/2705.svg\" width=\"20\" height=\"20\" alt=\"OK\">";
    readonly CROSS: "<img src=\"https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/274c.svg\" width=\"20\" height=\"20\" alt=\"NG\">";
    readonly WARNING: "<img src=\"https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/26a0.svg\" width=\"20\" height=\"20\" alt=\"Warning\">";
};
/**
 * Valid author associations that can use the /lysbot merge command.
 * Why: Only trusted users with write access should be able to trigger merges.
 * OWNER/MEMBER have org-level trust, COLLABORATOR has explicit repo access.
 * CONTRIBUTOR and others may have submitted PRs but lack merge authority.
 */
export declare const VALID_AUTHOR_ASSOCIATIONS: readonly ["OWNER", "MEMBER", "COLLABORATOR"];
/**
 * Valid permission levels that can use the /lysbot merge command.
 * Why: Maps to GitHub's permission model - admin/maintain/write can merge PRs.
 * Read-only users should not be able to trigger merges even if they can comment.
 */
export declare const VALID_PERMISSIONS: readonly ["admin", "maintain", "write"];
/**
 * Valid Conventional Commits types for PR title validation.
 * See https://www.conventionalcommits.org/
 *
 * Note: `ux` is a project-specific additional custom type for user experience improvements.
 */
export declare const CONVENTIONAL_COMMIT_TYPES: readonly ["build", "chore", "ci", "docs", "feat", "fix", "perf", "refactor", "revert", "style", "test", "ux"];
/**
 * Regex pattern for validating Conventional Commits format.
 * Format: <type>(<optional scope>): <description>
 * The description must contain at least one non-whitespace character.
 * Examples:
 * - feat: add new feature
 * - fix(auth): resolve login issue
 * - docs(readme): update installation guide
 */
export declare const CONVENTIONAL_COMMIT_REGEX: RegExp;
