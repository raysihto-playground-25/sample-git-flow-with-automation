import type { CommitInfo, Octokit, PullRequestData, ReviewsArray } from '../../common/types.js';

/**
 * Repository interface for GitHub API operations.
 * All external I/O operations are abstracted through this interface.
 */
export interface GitHubRepository {
  addReaction(
    owner: string,
    repo: string,
    commentId: number,
    reaction: '+1' | '-1' | 'laugh' | 'confused' | 'heart' | 'hooray' | 'rocket' | 'eyes',
  ): Promise<void>;

  postComment(owner: string, repo: string, prNumber: number, body: string): Promise<void>;

  getCollaboratorPermission(owner: string, repo: string, username: string): Promise<string>;

  fetchPullRequestData(owner: string, repo: string, prNumber: number): Promise<PullRequestData>;

  fetchApprovedReviews(owner: string, repo: string, prNumber: number): Promise<ReviewsArray>;

  dismissReview(owner: string, repo: string, prNumber: number, reviewId: number, message: string): Promise<boolean>;

  countUnresolvedThreads(owner: string, repo: string, prNumber: number): Promise<number>;

  fetchPullRequestCommits(owner: string, repo: string, prNumber: number): Promise<CommitInfo[]>;

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

/**
 * Factory function type for creating GitHubRepository instances.
 */
export type GitHubRepositoryFactory = (octokit: Octokit) => GitHubRepository;
