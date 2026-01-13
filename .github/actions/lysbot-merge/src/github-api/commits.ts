import type { Octokit } from '../types/index.js';

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
