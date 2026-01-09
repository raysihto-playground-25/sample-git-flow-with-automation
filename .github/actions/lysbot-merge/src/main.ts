/**
 * main.ts - Composition Root for lysbot-merge
 *
 * This file is responsible for:
 * 1. Reading inputs from GitHub Actions environment
 * 2. Instantiating infrastructure adapters
 * 3. Injecting dependencies into feature modules (Manual DI)
 * 4. Setting outputs and writing summaries
 *
 * Following the Lightweight Modular Monolith architecture:
 * This is the composition root where manual dependency injection happens.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';

import type { ActionConfig, EventContext } from './shared/kernel/types.js';
import {
  executeAction,
  buildSummaryMarkdown,
  OctokitGitHubAdapter,
  NodeTimeAdapter,
  CoreLogAdapter,
} from './modules/merge/index.js';

/**
 * Main function that assembles the application and runs it.
 */
export async function run(): Promise<void> {
  try {
    // Read inputs from GitHub Actions environment
    const token = core.getInput('github-token', { required: true });
    const config: ActionConfig = {
      releaseBranchPrefix: core.getInput('release_branch_prefix') || 'release/',
      developBranch: core.getInput('develop_branch') || 'develop',
      syncBranchPrefix: core.getInput('sync_branch_prefix') || 'fix/sync/',
      mergeableRetryCount: parseInt(core.getInput('mergeable_retry_count') || '5', 10),
      mergeableRetryInterval: parseInt(core.getInput('mergeable_retry_interval') || '10', 10),
    };

    // Get event context from GitHub Actions runtime
    const payload = github.context.payload;

    const context: EventContext = {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      prNumber: payload.issue?.number ?? 0,
      commentId: payload.comment?.id ?? 0,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      commentBody: payload.comment?.body ?? '',
      actor: github.context.actor,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      userType: payload.comment?.user?.type ?? 'User',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      authorAssociation: payload.comment?.author_association ?? 'NONE',
      serverUrl: process.env.GITHUB_SERVER_URL ?? 'https://github.com',
      runId: github.context.runId,
      eventName: github.context.eventName,
      isPullRequest: !!payload.issue?.pull_request,
    };

    // Instantiate infrastructure adapters (Manual DI)
    const octokit = github.getOctokit(token);
    const githubAdapter = new OctokitGitHubAdapter(octokit, context.owner, context.repo);
    const timeAdapter = new NodeTimeAdapter();
    const logAdapter = new CoreLogAdapter();

    // Inject dependencies and run the main logic
    const result = await executeAction(githubAdapter, timeAdapter, logAdapter, context, config);

    // Set outputs
    core.setOutput('result', result.status);
    if (result.mergeMethod) {
      core.setOutput('merge_method', result.mergeMethod);
    }

    // Write summary
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
