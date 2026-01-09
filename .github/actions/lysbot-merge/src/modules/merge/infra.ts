/**
 * infra.ts - Infrastructure adapters for GitHub API
 *
 * This module implements the ports defined in app.ts using Octokit.
 * 
 * ARCHITECTURE: This is the INFRA layer - it can import from app and kernel,
 * but must NOT import from domain directly.
 */

import type { GitHub } from '@actions/github/lib/utils.js';
import type { IGitHubRepository, Review, Commit, MergeOperationResult, ILogger, ITimeProvider } from './app.js';
import type { PullRequestData } from './domain.js';

/**
 * Type alias for Octokit instance.
 */
export type Octokit = InstanceType<typeof GitHub>;

/**
 * GitHub Repository adapter that implements IGitHubRepository using Octokit.
 */
export class GitHubRepositoryAdapter implements IGitHubRepository {
  constructor(private readonly octokit: Octokit) {}

  async addReaction(
    owner: string,
    repo: string,
    commentId: number,
    reaction: '+1' | '-1' | 'laugh' | 'confused' | 'heart' | 'hooray' | 'rocket' | 'eyes',
  ): Promise<void> {
    try {
      await this.octokit.rest.reactions.createForIssueComment({
        owner,
        repo,
        comment_id: commentId,
        content: reaction,
      });
    } catch {
      // Silently fail - reaction may already exist
    }
  }

  async postComment(owner: string, repo: string, prNumber: number, body: string): Promise<void> {
    await this.octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
  }

  async getCollaboratorPermission(owner: string, repo: string, username: string): Promise<string> {
    try {
      const response = await this.octokit.rest.repos.getCollaboratorPermissionLevel({
        owner,
        repo,
        username,
      });
      return response.data.permission;
    } catch {
      return 'none';
    }
  }

  async fetchPullRequestData(owner: string, repo: string, prNumber: number): Promise<PullRequestData> {
    const response = await this.octokit.rest.pulls.get({
      owner,
      repo,
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

  async fetchApprovedReviews(owner: string, repo: string, prNumber: number): Promise<Review[]> {
    const reviews = await this.octokit.paginate(this.octokit.rest.pulls.listReviews, {
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    });
    return reviews.filter((review) => review.state === 'APPROVED').map((review) => ({
      id: review.id,
      state: review.state,
      commit_id: review.commit_id,
      user: review.user,
    }));
  }

  async dismissReview(
    owner: string,
    repo: string,
    prNumber: number,
    reviewId: number,
    message: string,
  ): Promise<boolean> {
    try {
      await this.octokit.rest.pulls.dismissReview({
        owner,
        repo,
        pull_number: prNumber,
        review_id: reviewId,
        message,
      });
      return true;
    } catch {
      return false;
    }
  }

  async countUnresolvedThreads(owner: string, repo: string, prNumber: number): Promise<number> {
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
        owner,
        name: repo,
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

  async fetchPullRequestCommits(owner: string, repo: string, prNumber: number): Promise<Commit[]> {
    const commits = await this.octokit.paginate(this.octokit.rest.pulls.listCommits, {
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    });
    return commits;
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
    try {
      const response = await this.octokit.rest.pulls.merge({
        owner,
        repo,
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

/**
 * Logger adapter that uses console.
 * In production, this can be replaced with an adapter using @actions/core.
 */
export class ConsoleLogger implements ILogger {
  info(message: string): void {
    console.log(`[INFO] ${message}`);
  }

  warning(message: string): void {
    console.warn(`[WARN] ${message}`);
  }

  error(message: string): void {
    console.error(`[ERROR] ${message}`);
  }
}

/**
 * Time provider implementation using native setTimeout.
 */
export class TimeProvider implements ITimeProvider {
  async waitMs(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
