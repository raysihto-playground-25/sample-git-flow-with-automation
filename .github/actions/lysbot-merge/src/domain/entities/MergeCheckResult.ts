/**
 * MergeCheckResult entity - Represents a single merge validation check result
 *
 * Used to track the status of individual checks in the merge validation process.
 */

export interface MergeCheckResult {
  name: string;
  passed: boolean;
  details?: string;
  /** If true, this check does not block the merge even when it fails */
  optional?: boolean;
}
