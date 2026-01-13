import type { Octokit } from '../types/index.js';

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
