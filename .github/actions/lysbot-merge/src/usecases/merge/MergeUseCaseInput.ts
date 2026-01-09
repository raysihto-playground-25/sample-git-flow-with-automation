/**
 * MergeUseCaseInput.ts - Input DTO for the merge use case
 *
 * Defines what data the merge use case needs to execute.
 */

/**
 * Configuration options for the merge use case.
 */
export interface MergeConfig {
  /** Prefix for release branches (e.g., "release/") */
  releaseBranchPrefix: string;
  /** Name of the develop branch */
  developBranch: string;
  /** Prefix for sync branches used in back-merges */
  syncBranchPrefix: string;
  /** Number of retries for mergeable status calculation */
  mergeableRetryCount: number;
  /** Interval in seconds between retries */
  mergeableRetryInterval: number;
}

/**
 * Context from the GitHub event that triggered the merge.
 */
export interface EventContext {
  /** PR number */
  prNumber: number;
  /** Comment ID that triggered the action */
  commentId: number;
  /** Comment body text */
  commentBody: string;
  /** User who made the comment */
  actor: string;
  /** Type of user (User, Bot, etc.) */
  userType: string;
  /** Author association with the repository */
  authorAssociation: string;
  /** GitHub event name (e.g., 'issue_comment') */
  eventName: string;
  /** Whether this is a PR comment (not an issue comment) */
  isPullRequest: boolean;
}
