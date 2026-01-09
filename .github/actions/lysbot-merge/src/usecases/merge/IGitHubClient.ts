/**
 * IGitHubClient.ts - Port interface for GitHub API interactions
 *
 * This interface defines what the use case needs from GitHub,
 * not a mirror of the Octokit API. It's designed from the use case's perspective.
 */

import type { PullRequest } from '../../domain/entities/PullRequest.js';
import type { Review } from '../../domain/entities/Review.js';

/**
 * Commit information from a pull request.
 */
export interface Commit {
  commit: {
    message: string;
    author?: {
      name?: string;
      email?: string;
    } | null;
  };
}

/**
 * Port interface for GitHub API interactions.
 * Defines the capabilities the merge use case needs from GitHub.
 */
export interface IGitHubClient {
  /**
   * Adds a reaction to a comment.
   */
  addReaction(commentId: number, reaction: '+1' | '-1' | 'laugh' | 'confused' | 'heart' | 'hooray' | 'rocket' | 'eyes'): Promise<void>;

  /**
   * Posts a comment on a PR.
   */
  postComment(prNumber: number, body: string): Promise<void>;

  /**
   * Gets the collaborator permission level for a user.
   */
  getCollaboratorPermission(username: string): Promise<string>;

  /**
   * Fetches PR data.
   */
  fetchPullRequest(prNumber: number): Promise<PullRequest>;

  /**
   * Fetches all approved reviews for a PR.
   */
  fetchApprovedReviews(prNumber: number): Promise<Review[]>;

  /**
   * Dismisses a review.
   */
  dismissReview(prNumber: number, reviewId: number, message: string): Promise<boolean>;

  /**
   * Counts unresolved review threads.
   */
  countUnresolvedThreads(prNumber: number): Promise<number>;

  /**
   * Fetches the list of commits in a PR.
   */
  fetchPullRequestCommits(prNumber: number): Promise<Commit[]>;

  /**
   * Performs the merge operation.
   */
  mergePullRequest(
    prNumber: number,
    method: 'squash' | 'merge',
    sha: string,
    commitTitle: string,
    commitMessage: string,
  ): Promise<{ success: boolean; error?: string; mergeCommitSha?: string }>;
}
