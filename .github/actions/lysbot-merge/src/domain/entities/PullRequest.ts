/**
 * PullRequest.ts - Pull Request domain entity
 *
 * Represents a pull request in the domain model.
 * This is a pure domain entity with no dependencies on external infrastructure.
 */

/**
 * Pull request data in the domain model.
 * Represents the essential state of a pull request needed for merge operations.
 */
export interface PullRequest {
  /** Current state of the PR (open, closed) */
  state: string;
  /** Whether the PR is locked */
  locked: boolean;
  /** Whether the PR is a draft */
  draft: boolean;
  /** Whether the PR has been merged */
  merged: boolean;
  /** Whether the PR can be merged (null if not computed yet) */
  mergeable: boolean | null;
  /** Detailed mergeable state from GitHub */
  mergeableState: string;
  /** SHA of the head commit */
  headSha: string;
  /** Name of the head branch */
  headRef: string;
  /** Name of the base branch */
  baseRef: string;
  /** Login of the PR author */
  author: string;
  /** Whether the PR is from a fork */
  isFork: boolean;
  /** Title of the PR */
  title: string;
}
