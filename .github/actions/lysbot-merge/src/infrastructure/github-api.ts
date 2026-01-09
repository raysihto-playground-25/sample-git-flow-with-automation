import type { Octokit, PullRequestData, ReviewsArray } from '../domain/types.js';

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
  }
}

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

export function waitBeforeRetryMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
