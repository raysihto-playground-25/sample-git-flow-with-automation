import type { Octokit } from '../types/index.js';

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
