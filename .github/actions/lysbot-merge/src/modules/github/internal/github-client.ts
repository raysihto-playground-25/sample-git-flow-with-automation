import type { Octokit } from './types.js';

export interface GithubClient {
  addReaction(
    owner: string,
    repo: string,
    commentId: number,
    reaction: '+1' | '-1' | 'laugh' | 'confused' | 'heart' | 'hooray' | 'rocket' | 'eyes',
  ): Promise<void>;
  postComment(owner: string, repo: string, prNumber: number, body: string): Promise<void>;
  getCollaboratorPermission(owner: string, repo: string, username: string): Promise<string>;
}

export class DefaultGithubClient implements GithubClient {
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
      /* */
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
}
