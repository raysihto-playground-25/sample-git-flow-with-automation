/**
 * GitHubClient.ts - GitHub API client adapter
 *
 * This adapter implements the IGitHubClient port using Octokit.
 * It converts between the domain model and the GitHub API.
 */

import type { IGitHubClient, Commit } from '../../usecases/merge/IGitHubClient.js';
import type { PullRequest } from '../../domain/entities/PullRequest.js';
import type { Review } from '../../domain/entities/Review.js';

/**
 * Octokit type (imported from external library)
 */
export type Octokit = {
  rest: {
    reactions: {
      createForIssueComment: (params: {
        owner: string;
        repo: string;
        comment_id: number;
        content: string;
      }) => Promise<unknown>;
    };
    issues: {
      createComment: (params: { owner: string; repo: string; issue_number: number; body: string }) => Promise<unknown>;
    };
    repos: {
      getCollaboratorPermissionLevel: (params: {
        owner: string;
        repo: string;
        username: string;
      }) => Promise<{ data: { permission: string } }>;
    };
    pulls: {
      get: (params: { owner: string; repo: string; pull_number: number }) => Promise<{
        data: {
          state: string;
          locked: boolean;
          draft?: boolean;
          merged: boolean;
          mergeable: boolean | null;
          mergeable_state: string;
          head: { sha: string; ref: string; repo: { fork?: boolean; owner?: { id?: number } } | null };
          base: { ref: string; repo?: { owner?: { id?: number } } };
          user: { login: string } | null;
          title: string;
        };
      }>;
      listReviews: (params: {
        owner: string;
        repo: string;
        pull_number: number;
        per_page: number;
      }) => Promise<{
        data: Array<{
          id: number;
          state: string;
          commit_id: string | null;
          user: { login: string } | null;
        }>;
      }>;
      dismissReview: (params: {
        owner: string;
        repo: string;
        pull_number: number;
        review_id: number;
        message: string;
      }) => Promise<unknown>;
      listCommits: (params: {
        owner: string;
        repo: string;
        pull_number: number;
        per_page: number;
      }) => Promise<{
        data: Array<{
          commit: {
            message: string;
            author?: { name?: string; email?: string } | null;
          };
        }>;
      }>;
      merge: (params: {
        owner: string;
        repo: string;
        pull_number: number;
        merge_method: string;
        sha: string;
        commit_title: string;
        commit_message: string;
      }) => Promise<{ data: { sha: string } }>;
    };
  };
  paginate: <T>(
    method: (params: unknown) => Promise<{ data: T[] }>,
    params: unknown,
  ) => Promise<T[]>;
  graphql: <T>(query: string, params: unknown) => Promise<T>;
};

/**
 * GitHub API client adapter.
 * Implements IGitHubClient using Octokit.
 */
export class GitHubClient implements IGitHubClient {
  constructor(
    private readonly octokit: Octokit,
    private readonly owner: string,
    private readonly repo: string,
  ) {}

  async addReaction(
    commentId: number,
    reaction: '+1' | '-1' | 'laugh' | 'confused' | 'heart' | 'hooray' | 'rocket' | 'eyes',
  ): Promise<void> {
    try {
      await this.octokit.rest.reactions.createForIssueComment({
        owner: this.owner,
        repo: this.repo,
        comment_id: commentId,
        content: reaction,
      });
    } catch {
      // Silently fail - reaction may already exist
    }
  }

  async postComment(prNumber: number, body: string): Promise<void> {
    await this.octokit.rest.issues.createComment({
      owner: this.owner,
      repo: this.repo,
      issue_number: prNumber,
      body,
    });
  }

  async getCollaboratorPermission(username: string): Promise<string> {
    try {
      const response = await this.octokit.rest.repos.getCollaboratorPermissionLevel({
        owner: this.owner,
        repo: this.repo,
        username,
      });
      return response.data.permission;
    } catch {
      return 'none';
    }
  }

  async fetchPullRequest(prNumber: number): Promise<PullRequest> {
    const response = await this.octokit.rest.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
    });
    const pr = response.data;

    // Detect fork using robust logic
    const isFork = pr.head.repo?.fork === true || pr.head.repo?.owner?.id !== pr.base.repo?.owner?.id;

    return {
      state: pr.state,
      locked: pr.locked,
      draft: pr.draft ?? false,
      merged: pr.merged,
      mergeable: pr.mergeable,
      mergeableState: pr.mergeable_state,
      headSha: pr.head.sha,
      headRef: pr.head.ref,
      baseRef: pr.base.ref,
      author: pr.user?.login ?? 'unknown',
      isFork,
      title: pr.title,
    };
  }

  async fetchApprovedReviews(prNumber: number): Promise<Review[]> {
    const reviews = await this.octokit.paginate(this.octokit.rest.pulls.listReviews, {
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      per_page: 100,
    });
    return reviews.filter((review) => review.state === 'APPROVED');
  }

  async dismissReview(prNumber: number, reviewId: number, message: string): Promise<boolean> {
    try {
      await this.octokit.rest.pulls.dismissReview({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        review_id: reviewId,
        message,
      });
      return true;
    } catch {
      return false;
    }
  }

  async countUnresolvedThreads(prNumber: number): Promise<number> {
    let unresolvedCount = 0;
    let hasNextPage = true;
    let cursor: string | null = null;

    const query = `
      query($owner: String!, $name: String!, $number: Int!, $cursor: String) {
        repository(owner: $owner, name: $name) {
          pullRequest(number: $number) {
            reviewThreads(first: 100, after: $cursor) {
              pageInfo {
                hasNextPage
                endCursor
              }
              nodes {
                isResolved
              }
            }
          }
        }
      }
    `;

    while (hasNextPage) {
      const response: {
        repository: {
          pullRequest: {
            reviewThreads: {
              pageInfo: { hasNextPage: boolean; endCursor: string | null };
              nodes: Array<{ isResolved: boolean }>;
            };
          };
        };
      } = await this.octokit.graphql(query, {
        owner: this.owner,
        name: this.repo,
        number: prNumber,
        cursor,
      });

      const threads = response.repository.pullRequest.reviewThreads;
      unresolvedCount += threads.nodes.filter((n) => !n.isResolved).length;
      hasNextPage = threads.pageInfo.hasNextPage;
      cursor = threads.pageInfo.endCursor;
    }

    return unresolvedCount;
  }

  async fetchPullRequestCommits(prNumber: number): Promise<Commit[]> {
    const commits = await this.octokit.paginate(this.octokit.rest.pulls.listCommits, {
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      per_page: 100,
    });
    return commits;
  }

  async mergePullRequest(
    prNumber: number,
    method: 'squash' | 'merge',
    sha: string,
    commitTitle: string,
    commitMessage: string,
  ): Promise<{ success: boolean; error?: string; mergeCommitSha?: string }> {
    try {
      const response = await this.octokit.rest.pulls.merge({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        merge_method: method,
        sha,
        commit_title: commitTitle,
        commit_message: commitMessage,
      });
      return { success: true, mergeCommitSha: response.data.sha };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }
}
