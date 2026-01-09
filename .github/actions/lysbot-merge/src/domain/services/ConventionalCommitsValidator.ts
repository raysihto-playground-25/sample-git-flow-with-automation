/**
 * ConventionalCommitsValidator.ts - Domain service for Conventional Commits validation
 *
 * This service validates that commit messages follow the Conventional Commits format.
 */

/**
 * Valid Conventional Commits types.
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
 */
const CONVENTIONAL_COMMIT_REGEX = new RegExp(`^(${CONVENTIONAL_COMMIT_TYPES.join('|')})(\\([^)!]+\\))?!?:\\s*\\S.*$`);

/**
 * Domain service for validating Conventional Commits format.
 */
export class ConventionalCommitsValidator {
  /**
   * Checks if a PR title follows the Conventional Commits format.
   *
   * @param title - The PR title to validate
   * @returns true if the title follows Conventional Commits format
   *
   * @example
   * validator.isValid('feat: add new feature')           // true
   * validator.isValid('fix(auth): resolve login issue')  // true
   * validator.isValid('Update README')                   // false
   */
  isValid(title: string): boolean {
    return CONVENTIONAL_COMMIT_REGEX.test(title);
  }
}
