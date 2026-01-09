/**
 * MergeMethod value object - Represents the method and reasoning for merging a PR
 *
 * This is a value object because it's defined by its values, not its identity.
 */

export interface MergeMethod {
  method: 'squash' | 'merge';
  reason: string;
}
