/**
 * GitHubClient port - Interface for GitHub API interactions
 *
 * This port is defined from the UseCase's perspective, containing only
 * the operations needed for the merge use case. It's not a mirror of the
 * Octokit API, but rather an abstraction of what the use case requires.
 */

import type { PullRequest } from '../../domain/entities/PullRequest.js';

/**
 * Review data structure
 */
export interface Review {
  id: number;
  user?: {
    login?: string;
  } | null;
  state: string;
  commit_id: string | null;
}

/**
 * Commit data structure
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
 * GitHub client interface for merge use case operations
 */
export interface GitHubClient {
  /**
   * Adds a reaction to a comment.
   */
  addReaction(
    owner: string,
    repo: string,
    commentId: number,
    reaction: '+1' | '-1' | 'laugh' | 'confused' | 'heart' | 'hooray' | 'rocket' | 'eyes',
  ): Promise<void>;

  /**
   * Posts a comment on a PR.
   */
  postComment(owner: string, repo: string, prNumber: number, body: string): Promise<void>;

  /**
   * Gets the collaborator permission level for a user.
   */
  getCollaboratorPermission(owner: string, repo: string, username: string): Promise<string>;

  /**
   * Fetches PR data.
   */
  fetchPullRequest(owner: string, repo: string, prNumber: number): Promise<PullRequest>;

  /**
   * Fetches all approved reviews for a PR.
   */
  fetchApprovedReviews(owner: string, repo: string, prNumber: number): Promise<Review[]>;

  /**
   * Dismisses a stale review.
   */
  dismissReview(owner: string, repo: string, prNumber: number, reviewId: number, message: string): Promise<boolean>;

  /**
   * Counts unresolved review threads.
   */
  countUnresolvedThreads(owner: string, repo: string, prNumber: number): Promise<number>;

  /**
   * Fetches the list of commits in a PR.
   */
  fetchPullRequestCommits(owner: string, repo: string, prNumber: number): Promise<Commit[]>;

  /**
   * Performs the merge operation.
   */
  mergePullRequest(
    owner: string,
    repo: string,
    prNumber: number,
    method: 'squash' | 'merge',
    sha: string,
    commitTitle: string,
    commitMessage: string,
  ): Promise<{ success: boolean; error?: string; mergeCommitSha?: string }>;
}
