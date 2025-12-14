/**
 * main.ts - Entry point for the lysbot-merge GitHub Action
 *
 * This file is the main entry point that runs in the GitHub Actions environment.
 * It is responsible for:
 * 1. Reading inputs from the GitHub Actions environment
 * 2. Handling deprecated input parameters with warnings
 * 3. Parsing options YAML and constructing configuration
 * 4. Constructing the event context from github.context
 * 5. Calling the main action logic from action.ts
 * 6. Setting outputs and writing summaries
 *
 * TESTING APPROACH:
 * =================
 * This file contains GitHub Actions runtime integration code and has been tested
 * using vitest mocks to verify:
 * - Deprecated input handling and warning messages
 * - Options parsing with deprecated input fallbacks
 * - Integer parsing for numeric inputs
 * - Error handling and reporting
 *
 * The core business logic remains in action.ts (executeAction, buildSummaryMarkdown)
 * which has comprehensive test coverage independent of GitHub Actions runtime.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';

import { executeAction, buildSummaryMarkdown } from './action.js';
import { parseOptions } from './options-parser.js';
import type { EventContext } from './types.js';

/**
 * Main function that runs the action.
 *
 * This function:
 * 1. Reads inputs from GitHub Actions environment (core.getInput)
 * 2. Handles deprecated input parameters with warnings
 * 3. Parses options YAML with deprecated input fallbacks
 * 4. Reads context from GitHub Actions runtime (github.context, process.env)
 * 5. Delegates all merge business logic to executeAction() in action.ts
 * 6. Writes outputs to GitHub Actions environment (core.setOutput, core.summary)
 *
 * This function is tested using vitest mocks to verify the deprecated input
 * handling, options parsing, and error handling logic.
 */
export async function run(): Promise<void> {
  try {
    // Get inputs
    const token = core.getInput('github-token', { required: true });
    const optionsYaml = core.getInput('options') || '';

    // Check for deprecated individual inputs
    const deprecatedInputs: {
      releaseBranchPrefix?: string;
      developBranch?: string;
      syncBranchPrefix?: string;
      mergeableRetryCount?: number;
      mergeableRetryInterval?: number;
    } = {};

    const releaseBranchPrefix = core.getInput('release_branch_prefix');
    const developBranch = core.getInput('develop_branch');
    const syncBranchPrefix = core.getInput('sync_branch_prefix');
    const mergeableRetryCount = core.getInput('mergeable_retry_count');
    const mergeableRetryInterval = core.getInput('mergeable_retry_interval');

    // Collect deprecated inputs and show warnings
    if (releaseBranchPrefix) {
      core.warning(
        'The "release_branch_prefix" input is deprecated and will be removed in a future version. ' +
          'Please use the "options" parameter with "release-branch-prefix" key instead.',
      );
      deprecatedInputs.releaseBranchPrefix = releaseBranchPrefix;
    }
    if (developBranch) {
      core.warning(
        'The "develop_branch" input is deprecated and will be removed in a future version. ' +
          'Please use the "options" parameter with "develop-branch" key instead.',
      );
      deprecatedInputs.developBranch = developBranch;
    }
    if (syncBranchPrefix) {
      core.warning(
        'The "sync_branch_prefix" input is deprecated and will be removed in a future version. ' +
          'Please use the "options" parameter with "sync-branch-prefix" key instead.',
      );
      deprecatedInputs.syncBranchPrefix = syncBranchPrefix;
    }
    if (mergeableRetryCount) {
      core.warning(
        'The "mergeable_retry_count" input is deprecated and will be removed in a future version. ' +
          'Please use the "options" parameter with "mergeable-retry-count" key instead.',
      );
      const count = parseInt(mergeableRetryCount, 10);
      if (!Number.isNaN(count)) {
        deprecatedInputs.mergeableRetryCount = count;
      }
    }
    if (mergeableRetryInterval) {
      core.warning(
        'The "mergeable_retry_interval" input is deprecated and will be removed in a future version. ' +
          'Please use the "options" parameter with "mergeable-retry-interval" key instead.',
      );
      const interval = parseInt(mergeableRetryInterval, 10);
      if (!Number.isNaN(interval)) {
        deprecatedInputs.mergeableRetryInterval = interval;
      }
    }

    // Parse options with deprecated inputs as defaults
    const config = parseOptions(optionsYaml, Object.keys(deprecatedInputs).length > 0 ? deprecatedInputs : undefined);

    // Get event context
    //
    // Note:
    //   - github.context.payload is intentionally typed as unknown, so some property accesses
    //     cannot be made fully type-safe. In those cases, we selectively disable ESLint on specific
    //     lines rather than adding noisy type assertions.
    const payload = github.context.payload;

    // Build event context
    const context: EventContext = {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      // prNumber will be 0 if this is not a PR comment, but that's acceptable
      // because executeAction() will skip early when isPullRequest is false
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

    // Run the main logic
    const result = await executeAction(octokit, context, config);

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
