/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */

import * as core from '@actions/core';
import * as github from '@actions/github';

import { ActionExecutor } from './action-executor.js';
import { buildSummaryMarkdown } from './formatting.js';
import { GitHubClient } from './github-client.js';
import type { ActionConfig, EventContext } from './types.js';

export class ActionRunner {
  constructor(
    private readonly core: typeof core,
    private readonly github: typeof github,
  ) {}

  async run(): Promise<void> {
    try {
      const token = this.core.getInput('github-token', { required: true });
      const config: ActionConfig = {
        releaseBranchPrefix: this.core.getInput('release_branch_prefix') || 'release/',
        developBranch: this.core.getInput('develop_branch') || 'develop',
        syncBranchPrefix: this.core.getInput('sync_branch_prefix') || 'fix/sync/',
        mergeableRetryCount: parseInt(this.core.getInput('mergeable_retry_count') || '5', 10),
        mergeableRetryInterval: parseInt(this.core.getInput('mergeable_retry_interval') || '10', 10),
      };

      const octokit = this.github.getOctokit(token);
      const githubClient = new GitHubClient(octokit);
      const executor = new ActionExecutor(githubClient, config, this.core);

      const payload = this.github.context.payload;
      const context: EventContext = {
        owner: this.github.context.repo.owner,
        repo: this.github.context.repo.repo,
        prNumber: payload.issue?.number ?? 0,
        commentId: payload.comment?.id ?? 0,
        commentBody: payload.comment?.body ?? '',
        actor: this.github.context.actor,
        userType: payload.comment?.user?.type ?? 'User',
        authorAssociation: payload.comment?.author_association ?? 'NONE',
        serverUrl: process.env.GITHUB_SERVER_URL ?? 'https://github.com',
        runId: this.github.context.runId,
        eventName: this.github.context.eventName,
        isPullRequest: !!payload.issue?.pull_request,
      };

      const result = await executor.execute(context);
      this.core.setOutput('result', result.status);
      if (result.mergeMethod) {
        this.core.setOutput('merge_method', result.mergeMethod);
      }

      const resultEmoji = {
        merged: '✅ Merged successfully',
        skipped: '⏭️ Skipped',
        failed: '❌ Failed',
        already_merged: 'ℹ️ Already merged',
      }[result.status];

      const summaryMarkdown = buildSummaryMarkdown(resultEmoji, context.prNumber, context.actor, result.mergeMethod);
      await this.core.summary.addRaw(summaryMarkdown).write();
      this.core.info(`lysbot-merge result: ${result.status} - ${result.message}`);

      if (result.status === 'failed') {
        this.core.info('Merge checks or operation failed. See PR comments for details.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.core.setFailed(`lysbot-merge action failed: ${message}`);
    }
  }
}

/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument */
