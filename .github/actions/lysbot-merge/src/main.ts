/**
 * main.ts - Entry point for the lysbot-merge GitHub Action
 *
 * This file is the main entry point that runs in the GitHub Actions environment.
 * It is responsible for:
 * 1. Reading inputs from the GitHub Actions environment
 * 2. Constructing the event context from github.context
 * 3. Calling the main action logic from action.ts
 * 4. Setting outputs and writing summaries
 *
 * WHY THIS FILE IS UNTESTABLE:
 * ============================
 * This file contains ONLY GitHub Actions runtime integration code that:
 * 1. Depends on @actions/core global state (core.getInput, core.setOutput, core.summary)
 * 2. Depends on @actions/github global context (github.context, process.env)
 * 3. Has no business logic - only reads inputs, delegates to action.ts, and writes outputs
 *
 * TESTING APPROACH:
 * =================
 * - All business logic is in action.ts (executeAction, buildSummaryMarkdown) which IS fully tested
 * - This file is a thin integration layer with GitHub Actions runtime
 * - Testing this would require mocking the entire GitHub Actions environment, which provides
 *   no value since it only contains simple pass-through code with no conditional logic
 * - The real functionality is tested in action.test.ts with high coverage
 *
 * All testable logic has been moved to action.ts.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';

import { executeAction, buildSummaryMarkdown } from './action.js';
import { parseOptions } from './options-parser.js';
import type { EventContext } from './types.js';

/**
 * Main function that runs the action.
 *
 * WHY THIS FUNCTION IS NOT TESTED:
 * =================================
 * This function is a thin wrapper that:
 * 1. Reads inputs from GitHub Actions environment (core.getInput)
 * 2. Reads context from GitHub Actions runtime (github.context, process.env)
 * 3. Delegates all business logic to executeAction() in action.ts (which IS tested)
 * 4. Writes outputs to GitHub Actions environment (core.setOutput, core.summary)
 *
 * Testing this function would require:
 * - Mocking @actions/core global state
 * - Mocking @actions/github global context
 * - Mocking process.env
 * - Setting up a complete GitHub Actions environment simulation
 *
 * This provides no value because:
 * - There is no conditional logic or business rules in this function
 * - It's purely an adapter between GitHub Actions runtime and our business logic
 * - The business logic (executeAction, buildSummaryMarkdown) is fully tested in action.test.ts
 * - Any bugs would be immediately visible when running the action in a real workflow
 *
 * COVERAGE IMPACT:
 * ================
 * - This file intentionally has 0% test coverage
 * - All testable business logic has been extracted to action.ts (high coverage)
 * - This separation follows the "Humble Object" pattern for testing
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
      if (!isNaN(count)) {
        deprecatedInputs.mergeableRetryCount = count;
      }
    }
    if (mergeableRetryInterval) {
      core.warning(
        'The "mergeable_retry_interval" input is deprecated and will be removed in a future version. ' +
          'Please use the "options" parameter with "mergeable-retry-interval" key instead.',
      );
      const interval = parseInt(mergeableRetryInterval, 10);
      if (!isNaN(interval)) {
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
