/**
 * MergeMethod.ts - Merge method value object
 *
 * Represents a merge method decision with its reasoning.
 */

/**
 * Merge method and the reason for choosing it.
 * This is a value object that encapsulates the merge strategy decision.
 */
export interface MergeMethod {
  /** The merge method to use */
  method: 'squash' | 'merge';
  /** Human-readable reason for choosing this method */
  reason: string;
}
