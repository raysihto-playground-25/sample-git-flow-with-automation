/**
 * main.ts - Composition Root for lysbot-merge GitHub Action
 *
 * This file is responsible for wiring up dependencies and running the action.
 * It instantiates infra adapters and passes them to the action layer.
 *
 * ARCHITECTURE: This is the COMPOSITION ROOT - it assembles all dependencies
 * and delegates to the action layer.
 */

import * as github from '@actions/github';

import {
  runMergeAction,
  buildSummaryMarkdown,
  GitHubRepositoryAdapter,
  TimeProvider,
  type EventContext,
} from './modules/merge/index.js';
import { ActionsCore, ActionsLogger } from './shared/infra-shared/index.js';

/**
 * Main function that runs the action.
 * This function assembles dependencies and delegates to the action layer.
 */
export async function run(): Promise<void> {
  const core = new ActionsCore();

  try {
    // Get inputs - these are read once here and passed to the action
    const token = core.getInput('github-token', { required: true });

    // Get event context from GitHub Actions runtime
    const payload = github.context.payload;

    // Build event context
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

    // Create Octokit instance
    const octokit = github.getOctokit(token);

    // Assemble dependencies (Dependency Injection)
    const githubRepo = new GitHubRepositoryAdapter(octokit);
    const logger = new ActionsLogger();
    const timeProvider = new TimeProvider();

    const deps = {
      githubRepo,
      logger,
      timeProvider,
    };

    // Run the merge action
    const result = await runMergeAction(core, context, deps);

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

    // Mark as failed if the result status is failed
    if (result.status === 'failed') {
      // Don't fail the workflow - failures are communicated via PR comments
      core.info('Merge checks or operation failed. See PR comments for details.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    core.setFailed(`lysbot-merge action failed: ${message}`);
  }
}
