import * as core from '@actions/core';
import * as github from '@actions/github';

import type { ActionConfig, EventContext, Octokit } from './common/types.js';
import { buildSummaryMarkdown } from './common/utils.js';
import { MergeAction } from './modules/merge/merge.action.js';
import { OctokitGitHubRepository } from './modules/merge/infra/github.infra.js';

/**
 * Main entry point for the action logic.
 * This is the Composition Root - handles DI wiring and orchestration.
 */
export async function main(): Promise<void> {
  try {
    // Get configuration from inputs
    const token = core.getInput('github-token', { required: true });
    const config: ActionConfig = {
      releaseBranchPrefix: core.getInput('release_branch_prefix') || 'release/',
      developBranch: core.getInput('develop_branch') || 'develop',
      syncBranchPrefix: core.getInput('sync_branch_prefix') || 'fix/sync/',
      mergeableRetryCount: parseInt(core.getInput('mergeable_retry_count') || '5', 10),
      mergeableRetryInterval: parseInt(core.getInput('mergeable_retry_interval') || '10', 10),
    };

    // Build event context from GitHub context
    const payload = github.context.payload;
    const context: EventContext = {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      prNumber: payload.issue?.number ?? 0,
      commentId: payload.comment?.id ?? 0,
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
      commentBody: payload.comment?.body ?? '',
      actor: github.context.actor,
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
      userType: payload.comment?.user?.type ?? 'User',
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment */
      authorAssociation: payload.comment?.author_association ?? 'NONE',
      serverUrl: process.env.GITHUB_SERVER_URL ?? 'https://github.com',
      runId: github.context.runId,
      eventName: github.context.eventName,
      isPullRequest: !!payload.issue?.pull_request,
    };

    // Create Octokit instance
    const octokit: Octokit = github.getOctokit(token);

    // Wire dependencies (DI)
    const githubRepository = new OctokitGitHubRepository(octokit);
    const mergeAction = new MergeAction(githubRepository);

    // Execute the action
    const result = await mergeAction.execute(context, config);

    // Set outputs
    core.setOutput('result', result.status);
    if (result.mergeMethod) {
      core.setOutput('merge_method', result.mergeMethod);
    }

    // Build and write summary
    const resultEmoji = {
      merged: '✅ Merged successfully',
      skipped: '⏭️ Skipped',
      failed: '❌ Failed',
      already_merged: 'ℹ️ Already merged',
    }[result.status];
    const summaryMarkdown = buildSummaryMarkdown(resultEmoji, context.prNumber, context.actor, result.mergeMethod);
    await core.summary.addRaw(summaryMarkdown).write();

    // Log result
    core.info(`lysbot-merge result: ${result.status} - ${result.message}`);
    if (result.status === 'failed') {
      core.info('Merge checks or operation failed. See PR comments for details.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    core.setFailed(`lysbot-merge action failed: ${message}`);
  }
}
