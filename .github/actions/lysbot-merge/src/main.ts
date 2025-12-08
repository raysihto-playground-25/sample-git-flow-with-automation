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
 * This file contains UNTESTABLE code that depends on the GitHub Actions runtime.
 * All testable logic has been moved to action.ts.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import type { LysbotMergeConfig, EventContext } from './types';
import { lysbotMerge, buildSummaryMarkdown } from './action';

/**
 * Main function that runs the action.
 * This function is NOT TESTED and contains only GitHub Actions runtime code.
 */
async function run(): Promise<void> {
  try {
    // Get inputs
    const token = core.getInput('github-token', { required: true });
    const config: LysbotMergeConfig = {
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
    const result = await lysbotMerge(octokit, context, config);

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
