/**
 * MergeCheck.ts - Merge check domain entity
 *
 * Represents an individual validation check that must pass before merging.
 */

/**
 * Individual check result for the merge validation process.
 */
export interface MergeCheck {
  /** Human-readable name of the check */
  name: string;
  /** Whether the check passed */
  passed: boolean;
  /** Optional details about why the check failed or additional context */
  details?: string;
  /** If true, this check does not block the merge even when it fails */
  optional?: boolean;
}
