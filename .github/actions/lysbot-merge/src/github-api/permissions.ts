import type { Octokit } from '../types/index.js';

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
