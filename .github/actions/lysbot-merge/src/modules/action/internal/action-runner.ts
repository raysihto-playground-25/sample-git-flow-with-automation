import type * as core from '@actions/core';
import type * as github from '@actions/github';

import { executeAction, buildSummaryMarkdown } from './action-executor.js';
import type { ActionConfig, EventContext, Octokit } from './types.js';

export interface ActionRunner {
  run(): Promise<void>;
}

export function createActionRunner(
  coreModule: typeof core,
  githubContext: typeof github.context,
  octokit: Octokit,
): ActionRunner {
  return {
    async run(): Promise<void> {
      try {
        const config: ActionConfig = {
          releaseBranchPrefix: coreModule.getInput('release_branch_prefix') || 'release/',
          developBranch: coreModule.getInput('develop_branch') || 'develop',
          syncBranchPrefix: coreModule.getInput('sync_branch_prefix') || 'fix/sync/',
          mergeableRetryCount: parseInt(coreModule.getInput('mergeable_retry_count') || '5', 10),
          mergeableRetryInterval: parseInt(coreModule.getInput('mergeable_retry_interval') || '10', 10),
        };
        const payload = githubContext.payload;
        const context: EventContext = {
          owner: githubContext.repo.owner,
          repo: githubContext.repo.repo,
          prNumber: payload.issue?.number ?? 0,
          commentId: payload.comment?.id ?? 0,
          /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
          commentBody: payload.comment?.body ?? '',
          actor: githubContext.actor,
          /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
          userType: payload.comment?.user?.type ?? 'User',
          /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
          authorAssociation: payload.comment?.author_association ?? 'NONE',
          serverUrl: process.env.GITHUB_SERVER_URL ?? 'https://github.com',
          runId: githubContext.runId,
          eventName: githubContext.eventName,
          isPullRequest: !!payload.issue?.pull_request,
        };
        const result = await executeAction(octokit, context, config);
        coreModule.setOutput('result', result.status);
        if (result.mergeMethod) {
          coreModule.setOutput('merge_method', result.mergeMethod);
        }
        const resultEmoji = {
          merged: '✅ Merged successfully',
          skipped: '⏭️ Skipped',
          failed: '❌ Failed',
          already_merged: 'ℹ️ Already merged',
        }[result.status];
        const summaryMarkdown = buildSummaryMarkdown(resultEmoji, context.prNumber, context.actor, result.mergeMethod);
        await coreModule.summary.addRaw(summaryMarkdown).write();
        coreModule.info(`lysbot-merge result: ${result.status} - ${result.message}`);
        if (result.status === 'failed') {
          coreModule.info('Merge checks or operation failed. See PR comments for details.');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        coreModule.setFailed(`lysbot-merge action failed: ${message}`);
      }
    },
  };
}
