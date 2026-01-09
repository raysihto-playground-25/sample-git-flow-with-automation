/**
 * MergeResult.ts - Merge operation result value object
 *
 * Represents the outcome of a merge operation.
 */

/**
 * Overall result of the merge operation.
 * This value object encapsulates the outcome and details of a merge attempt.
 */
export interface MergeResult {
  /** Final status of the operation */
  status: 'merged' | 'skipped' | 'failed' | 'already_merged';
  /** Detailed message about what happened */
  message: string;
  /** Merge method used (if merged) */
  mergeMethod?: 'squash' | 'merge';
}
