/**
 * PullRequest entity - Domain model for Pull Request
 *
 * This represents the core Pull Request concept in our domain.
 * It contains only the properties relevant to the merge operation.
 */

export interface PullRequest {
  state: string;
  locked: boolean;
  draft: boolean;
  merged: boolean;
  mergeable: boolean | null;
  mergeableState: string;
  headSha: string;
  headRef: string;
  baseRef: string;
  author: string;
  isFork: boolean;
  title: string;
}
