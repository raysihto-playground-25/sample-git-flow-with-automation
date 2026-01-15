import type { Octokit, PullRequestData, ReviewsArray } from './types.js';

export interface PullRequestService {
  fetchPullRequestData(owner: string, repo: string, prNumber: number): Promise<PullRequestData>;
  fetchApprovedReviews(owner: string, repo: string, prNumber: number): Promise<ReviewsArray>;
  dismissReview(owner: string, repo: string, prNumber: number, reviewId: number, message: string): Promise<boolean>;
  countUnresolvedThreads(owner: string, repo: string, prNumber: number): Promise<number>;
  fetchPullRequestCommits(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<Array<{ commit: { message: string; author?: { name?: string; email?: string } | null } }>>;
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

export class DefaultPullRequestService implements PullRequestService {
  constructor(private readonly octokit: Octokit) {}

  async fetchPullRequestData(owner: string, repo: string, prNumber: number): Promise<PullRequestData> {
    const response = await this.octokit.rest.pulls.get({
      owner,
      repo,
      pull_number: prNumber,
    });
    const pr = response.data;

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

  async fetchApprovedReviews(owner: string, repo: string, prNumber: number): Promise<ReviewsArray> {
    const reviews = await this.octokit.paginate(this.octokit.rest.pulls.listReviews, {
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    });
    return reviews.filter((review) => review.state === 'APPROVED');
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

  async fetchPullRequestCommits(
    owner: string,
    repo: string,
    prNumber: number,
  ): Promise<Array<{ commit: { message: string; author?: { name?: string; email?: string } | null } }>> {
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
  ): Promise<{ success: boolean; error?: string; mergeCommitSha?: string }> {
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
