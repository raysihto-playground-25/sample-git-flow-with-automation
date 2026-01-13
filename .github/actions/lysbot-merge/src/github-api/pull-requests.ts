import type { Octokit, PullRequestData } from '../types/index.js';

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
