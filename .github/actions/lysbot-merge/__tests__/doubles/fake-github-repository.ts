/**
 * fake-github-repository.ts - Fake implementation of IGitHubRepository for testing
 *
 * This is a test double (fake) that maintains in-memory state for testing purposes.
 */

import type {
  IGitHubRepository,
  Review,
  Commit,
  MergeOperationResult,
} from '../../src/modules/merge/app.js';
import type { PullRequestData } from '../../src/modules/merge/domain.js';

/**
 * Fake GitHub Repository for testing.
 * This maintains in-memory state that can be inspected and modified.
 */
export class FakeGitHubRepository implements IGitHubRepository {
  // Track method calls for verification
  reactions: Array<{ owner: string; repo: string; commentId: number; reaction: string }> = [];
  comments: Array<{ owner: string; repo: string; prNumber: number; body: string }> = [];
  dismissedReviews: Array<{ prNumber: number; reviewId: number; message: string }> = [];

  // Configurable responses
  pullRequests: Map<number, PullRequestData> = new Map();
  permissions: Map<string, string> = new Map();
  reviews: Map<number, Review[]> = new Map();
  unresolvedThreadCounts: Map<number, number> = new Map();
  commits: Map<number, Commit[]> = new Map();
  mergeResults: Map<number, MergeOperationResult> = new Map();

  async addReaction(
    owner: string,
    repo: string,
    commentId: number,
    reaction: '+1' | '-1' | 'laugh' | 'confused' | 'heart' | 'hooray' | 'rocket' | 'eyes',
  ): Promise<void> {
    this.reactions.push({ owner, repo, commentId, reaction });
  }

  async postComment(owner: string, repo: string, prNumber: number, body: string): Promise<void> {
    this.comments.push({ owner, repo, prNumber, body });
  }

  async getCollaboratorPermission(owner: string, repo: string, username: string): Promise<string> {
    return this.permissions.get(username) ?? 'none';
  }

  async fetchPullRequestData(owner: string, repo: string, prNumber: number): Promise<PullRequestData> {
    const prData = this.pullRequests.get(prNumber);
    if (!prData) {
      throw new Error(`PR #${prNumber} not found in fake repository`);
    }
    return prData;
  }

  async fetchApprovedReviews(owner: string, repo: string, prNumber: number): Promise<Review[]> {
    return this.reviews.get(prNumber) ?? [];
  }

  async dismissReview(
    owner: string,
    repo: string,
    prNumber: number,
    reviewId: number,
    message: string,
  ): Promise<boolean> {
    this.dismissedReviews.push({ prNumber, reviewId, message });
    return true;
  }

  async countUnresolvedThreads(owner: string, repo: string, prNumber: number): Promise<number> {
    return this.unresolvedThreadCounts.get(prNumber) ?? 0;
  }

  async fetchPullRequestCommits(owner: string, repo: string, prNumber: number): Promise<Commit[]> {
    return this.commits.get(prNumber) ?? [];
  }

  async mergePullRequest(
    owner: string,
    repo: string,
    prNumber: number,
    method: 'squash' | 'merge',
    sha: string,
    commitTitle: string,
    commitMessage: string,
  ): Promise<MergeOperationResult> {
    const result = this.mergeResults.get(prNumber);
    if (result) {
      return result;
    }
    // Default success
    return { success: true, mergeCommitSha: 'abc123' };
  }

  // Helper methods for test setup
  setPullRequest(prNumber: number, data: PullRequestData): void {
    this.pullRequests.set(prNumber, data);
  }

  setPermission(username: string, permission: string): void {
    this.permissions.set(username, permission);
  }

  setReviews(prNumber: number, reviews: Review[]): void {
    this.reviews.set(prNumber, reviews);
  }

  setUnresolvedThreadCount(prNumber: number, count: number): void {
    this.unresolvedThreadCounts.set(prNumber, count);
  }

  setCommits(prNumber: number, commits: Commit[]): void {
    this.commits.set(prNumber, commits);
  }

  setMergeResult(prNumber: number, result: MergeOperationResult): void {
    this.mergeResults.set(prNumber, result);
  }
}
