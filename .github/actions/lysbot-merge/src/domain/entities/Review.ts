/**
 * Review.ts - Review domain entity
 *
 * Represents a code review on a pull request.
 */

/**
 * A code review on a pull request.
 */
export interface Review {
  /** Unique identifier of the review */
  id: number;
  /** State of the review (APPROVED, CHANGES_REQUESTED, COMMENTED, etc.) */
  state: string;
  /** SHA of the commit that was reviewed */
  commit_id: string | null;
  /** User who submitted the review */
  user: {
    login: string;
  } | null;
}
