/**
 * main.ts - Entry point for the lysbot-merge GitHub Action
 *
 * This file is the main entry point that runs in the GitHub Actions environment.
 * It is responsible for:
 * 1. Reading inputs from the GitHub Actions environment
 * 2. Parsing configuration from action inputs
 * 3. Constructing the event context from github.context
 * 4. Calling the main action logic from action.ts
 * 5. Setting outputs and writing summaries
 *
 * DESIGN PATTERN:
 * ===============
 * This module uses Dependency Injection (DI) to enable testing without mocks.
 * Dependencies (ActionsCore, GitHubContext, GitHubApiFactory) are injected via
 * an optional parameter, allowing tests to provide test doubles while production
 * code uses actual GitHub Actions modules.
 *
 * The core business logic remains in action.ts (executeAction, buildSummaryMarkdown)
 * which has comprehensive test coverage independent of GitHub Actions runtime.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';

import { executeAction, buildSummaryMarkdown } from './action.js';
import type { ActionConfig, EventContext, RunDependencies } from './types.js';

/**
 * Main function that runs the action.
 *
 * This function:
 * 1. Reads inputs from GitHub Actions environment (core.getInput)
 * 2. Reads context from GitHub Actions runtime (github.context, process.env)
 * 3. Delegates all merge business logic to executeAction() in action.ts
 * 4. Writes outputs to GitHub Actions environment (core.setOutput, core.summary)
 *
 * Dependencies are injected to enable testing without mocks (DI/DIP pattern).
 *
 * @param deps - Dependencies for GitHub Actions integration
 */
export async function run(deps?: RunDependencies): Promise<void> {
  // Use provided dependencies or default to actual GitHub Actions modules
  const actualCore = deps?.core ?? core;
  const actualContext = deps?.context ?? github.context;
  const actualApiFactory = deps?.apiFactory ?? github;
  const actualServerUrl = deps?.serverUrl ?? process.env.GITHUB_SERVER_URL ?? 'https://github.com';
  try {
    // Get inputs
    const token = actualCore.getInput('github-token', { required: true });
    const config: ActionConfig = {
      releaseBranchPrefix: actualCore.getInput('release_branch_prefix') || 'release/',
      developBranch: actualCore.getInput('develop_branch') || 'develop',
      syncBranchPrefix: actualCore.getInput('sync_branch_prefix') || 'fix/sync/',
      mergeableRetryCount: parseInt(actualCore.getInput('mergeable_retry_count') || '5', 10),
      mergeableRetryInterval: parseInt(actualCore.getInput('mergeable_retry_interval') || '10', 10),
    };

    // Get event context
    //
    // Note:
    //   - github.context.payload is intentionally typed as unknown, so some property accesses
    //     cannot be made fully type-safe. In those cases, we selectively disable ESLint on specific
    //     lines rather than adding noisy type assertions.
    const payload = actualContext.payload;

    // Build event context
    const context: EventContext = {
      owner: actualContext.repo.owner,
      repo: actualContext.repo.repo,
      // prNumber will be 0 if this is not a PR comment, but that's acceptable
      // because executeAction() will skip early when isPullRequest is false
      prNumber: payload.issue?.number ?? 0,
      commentId: payload.comment?.id ?? 0,
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- GitHub Actions event payload is typed as unknown */
      commentBody: payload.comment?.body ?? '',
      actor: actualContext.actor,
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- GitHub Actions event payload is typed as unknown */
      userType: payload.comment?.user?.type ?? 'User',
      /* eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- GitHub Actions event payload is typed as unknown */
      authorAssociation: payload.comment?.author_association ?? 'NONE',
      serverUrl: actualServerUrl,
      runId: actualContext.runId,
      eventName: actualContext.eventName,
      isPullRequest: !!payload.issue?.pull_request,
    };

    // Create Octokit instance
    const octokit = actualApiFactory.getOctokit(token);

    // Run the main logic
    const result = await executeAction(octokit, context, config);

    // Set outputs
    actualCore.setOutput('result', result.status);
    if (result.mergeMethod) {
      actualCore.setOutput('merge_method', result.mergeMethod);
    }

    // Write summary
    const resultEmoji = {
      merged: '✅ Merged successfully',
      skipped: '⏭️ Skipped',
      failed: '❌ Failed',
      already_merged: 'ℹ️ Already merged',
    }[result.status];

    const summaryMarkdown = buildSummaryMarkdown(resultEmoji, context.prNumber, context.actor, result.mergeMethod);
    await actualCore.summary.addRaw(summaryMarkdown).write();

    // Log result
    actualCore.info(`lysbot-merge result: ${result.status} - ${result.message}`);

    // Mark as failed if the result status is failed
    if (result.status === 'failed') {
      // Don't fail the workflow - failures are communicated via PR comments
      actualCore.info('Merge checks or operation failed. See PR comments for details.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    actualCore.setFailed(`lysbot-merge action failed: ${message}`);
  }
}
