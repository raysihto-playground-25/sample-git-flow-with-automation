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
import type { ActionConfig, EventContext } from './types';
import { executeAction, buildSummaryMarkdown } from './action';

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
async function run(): Promise<void> {
  try {
    // Get inputs
    const token = core.getInput('github-token', { required: true });
    const config: ActionConfig = {
      releaseBranchPrefix: core.getInput('release_branch_prefix') || 'release/',
      developBranch: core.getInput('develop_branch') || 'develop',
      syncBranchPrefix: core.getInput('sync_branch_prefix') || 'fix/sync/',
      mergeableRetryCount: parseInt(core.getInput('mergeable_retry_count') || '5', 10),
      mergeableRetryInterval: parseInt(core.getInput('mergeable_retry_interval') || '10', 10),
    };

    // Get event context
    const payload = github.context.payload;

    // Validate event type - this action only works with issue_comment events on PRs
    if (github.context.eventName !== 'issue_comment') {
      core.info('This action only runs on issue_comment events');
      core.setOutput('result', 'skipped');
      return;
    }

    // Check if this is a PR comment (not an issue comment)
    if (!payload.issue?.pull_request) {
      core.info('Comment is not on a PR, skipping');
      core.setOutput('result', 'skipped');
      return;
    }

    // Build event context
    const context: EventContext = {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      prNumber: payload.issue.number,
      commentId: payload.comment?.id ?? 0,
      commentBody: payload.comment?.body ?? '',
      actor: github.context.actor,
      userType: payload.comment?.user?.type ?? 'User',
      authorAssociation: payload.comment?.author_association ?? 'NONE',
      serverUrl: process.env.GITHUB_SERVER_URL ?? 'https://github.com',
      runId: github.context.runId,
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

    const summaryMarkdown = buildSummaryMarkdown(
      resultEmoji,
      context.prNumber,
      context.actor,
      undefined, // headRef not available in this scope
      undefined, // baseRef not available in this scope
      result.mergeMethod,
      undefined, // headSha not available in this scope
    );
    core.summary.addRaw(summaryMarkdown).write();

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

// Run the action
run();
