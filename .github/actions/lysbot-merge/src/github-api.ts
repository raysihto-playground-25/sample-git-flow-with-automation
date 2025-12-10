/**
 * github-api.ts - GitHub API interaction functions
 *
 * This module contains all functions that interact with the GitHub API.
 * These functions handle API calls, data fetching, and mutations.
 */

import type { Octokit, PullRequestData, ReviewsArray } from './types';

/**
 * Adds a reaction to a comment.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param commentId - Comment ID
 * @param reaction - Reaction to add
 */
export async function addReaction(
  octokit: Octokit,
  owner: string,
  repo: string,
  commentId: number,
  reaction: '+1' | '-1' | 'laugh' | 'confused' | 'heart' | 'hooray' | 'rocket' | 'eyes',
): Promise<void> {
  try {
    await octokit.rest.reactions.createForIssueComment({
      owner,
      repo,
      comment_id: commentId,
      content: reaction,
    });
  } catch {
    // Silently fail - reaction may already exist
  }
}

/**
 * Posts a comment on a PR.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - PR number
 * @param body - Comment body
 */
export async function postComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  body: string,
): Promise<void> {
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });
}

/**
 * Gets the collaborator permission level for a user.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param username - Username to check
 * @returns Permission level or 'none' on failure
 */
export async function getCollaboratorPermission(
  octokit: Octokit,
  owner: string,
  repo: string,
  username: string,
): Promise<string> {
  try {
    const response = await octokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username,
    });
    return response.data.permission;
  } catch {
    return 'none';
  }
}

/**
 * Fetches PR data from GitHub API.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - PR number
 * @returns Pull request data
 */
export async function fetchPullRequestData(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PullRequestData> {
  const response = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });
  const pr = response.data;

  // Detect fork using robust logic: check fork flag OR compare owner IDs
  // This handles cases where head.repo is null (e.g., fork repo deleted)
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

/**
 * Fetches all approved reviews for a PR.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - PR number
 * @returns Array of approved reviews
 */
export async function fetchApprovedReviews(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<ReviewsArray> {
  const reviews = await octokit.paginate(octokit.rest.pulls.listReviews, {
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });
  return reviews.filter((review) => review.state === 'APPROVED');
}

/**
 * Dismisses a stale review.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - PR number
 * @param reviewId - Review ID to dismiss
 * @param message - Dismissal message
 * @returns true if dismissed successfully
 */
export async function dismissReview(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  reviewId: number,
  message: string,
): Promise<boolean> {
  try {
    await octokit.rest.pulls.dismissReview({
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

/**
 * Counts unresolved review threads using GraphQL.
 * Why: REST API doesn't provide review thread resolution status, GraphQL is required.
 * Note: Counts ALL unresolved threads including outdated ones, matching GitHub's
 * "Require conversations to be resolved" branch protection behavior.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - PR number
 * @returns Number of unresolved threads
 */
export async function countUnresolvedThreads(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<number> {
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
    } = await octokit.graphql(query, {
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

/**
 * Fetches the list of commits in a PR.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - PR number
 * @returns Array of commit objects with commit message and author information
 */
export async function fetchPullRequestCommits(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<Array<{ commit: { message: string; author?: { name?: string; email?: string } | null } }>> {
  const commits = await octokit.paginate(octokit.rest.pulls.listCommits, {
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });
  return commits;
}

/**
 * Performs the merge operation.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - PR number
 * @param method - Merge method (squash or merge)
 * @param sha - Expected head SHA for TOCTOU check
 * @param commitTitle - Explicit commit title (first line of commit message)
 * @param commitMessage - Explicit commit message body (lines after the title and blank line)
 * @returns Object containing success status, error message, and merge commit SHA
 */
export async function mergePullRequest(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  method: 'squash' | 'merge',
  sha: string,
  commitTitle: string,
  commitMessage: string,
): Promise<{ success: boolean; error?: string; mergeCommitSha?: string }> {
  try {
    const response = await octokit.rest.pulls.merge({
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
