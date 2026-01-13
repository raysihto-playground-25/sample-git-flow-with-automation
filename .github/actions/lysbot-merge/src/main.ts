import * as core from '@actions/core';
import * as github from '@actions/github';

import { executeAction } from './action.js';
import { buildSummaryMarkdown } from './formatting/markdown.js';
import type { ActionConfig, EventContext } from './types/index.js';

export async function run(): Promise<void> {
  try {
    // Gather configuration from GitHub Actions inputs
    const token = core.getInput('github-token', { required: true });
    const config: ActionConfig = {
      releaseBranchPrefix: core.getInput('release_branch_prefix') || 'release/',
      developBranch: core.getInput('develop_branch') || 'develop',
      syncBranchPrefix: core.getInput('sync_branch_prefix') || 'fix/sync/',
      mergeableRetryCount: parseInt(core.getInput('mergeable_retry_count') || '5', 10),
      mergeableRetryInterval: parseInt(core.getInput('mergeable_retry_interval') || '10', 10),
    };

    // Gather event context from GitHub context
    const payload = github.context.payload as {
      issue?: { number?: number; pull_request?: unknown };
      comment?: { id?: number; body?: string; user?: { type?: string }; author_association?: string };
    };
    const context: EventContext = {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      prNumber: payload.issue?.number ?? 0,
      commentId: payload.comment?.id ?? 0,
      commentBody: payload.comment?.body ?? '',
      actor: github.context.actor,
      userType: payload.comment?.user?.type ?? 'User',
      authorAssociation: payload.comment?.author_association ?? 'NONE',
      serverUrl: process.env.GITHUB_SERVER_URL ?? 'https://github.com',
      runId: github.context.runId,
      eventName: github.context.eventName,
      isPullRequest: !!payload.issue?.pull_request,
    };

    // Construct Octokit client
    const octokit = github.getOctokit(token);

    // Execute the main action logic
    const result = await executeAction(octokit, context, config);

    // Set action outputs
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

    // Log results
    core.info(`lysbot-merge result: ${result.status} - ${result.message}`);

    if (result.status === 'failed') {
      core.info('Merge checks or operation failed. See PR comments for details.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    core.setFailed(`lysbot-merge action failed: ${message}`);
  }
}
