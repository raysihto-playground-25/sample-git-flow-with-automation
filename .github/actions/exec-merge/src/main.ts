/**
 * main.ts - Entry point for the exec-merge GitHub Action
 *
 * This file is the main entry point that:
 * 1. Reads inputs from the GitHub Actions environment
 * 2. Constructs the event context from github.context
 * 3. Calls the main execMerge function
 * 4. Sets outputs and handles errors
 *
 * The actual business logic is in exec-merge.ts for testability.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import {
  execMerge,
  type ExecMergeConfig,
  type EventContext,
} from './exec-merge';

/**
 * Writes a summary of the exec-merge operation to the GitHub Actions step summary.
 */
function writeSummary(
  result: string,
  prNumber: number,
  actor: string,
  headRef?: string,
  baseRef?: string,
  mergeMethod?: string,
  headSha?: string,
): void {
  let summary = `## exec-merge Summary\n\n`;
  summary += `| Item | Value |\n`;
  summary += `|------|-------|\n`;
  summary += `| **Result** | ${result} |\n`;
  summary += `| **PR** | #${prNumber} |\n`;
  summary += `| **Triggered by** | @${actor} |\n`;

  if (headRef && baseRef) {
    summary += `| **Head Branch** | \`${headRef}\` |\n`;
    summary += `| **Base Branch** | \`${baseRef}\` |\n`;
  }

  if (mergeMethod) {
    summary += `| **Merge Method** | \`${mergeMethod}\` |\n`;
  }

  if (headSha) {
    summary += `| **HEAD SHA** | ${headSha} |\n`;
  }

  core.summary.addRaw(summary).write();
}

/**
 * Main function that runs the action.
 */
async function run(): Promise<void> {
  try {
    // Get inputs
    const token = core.getInput('github-token', { required: true });
    const config: ExecMergeConfig = {
      releaseBranchPrefix: core.getInput('release_branch_prefix') || 'release/',
      developBranch: core.getInput('develop_branch') || 'develop',
      syncBranchPrefix: core.getInput('sync_branch_prefix') || 'fix/sync/',
      mergeableRetryCount: parseInt(
        core.getInput('mergeable_retry_count') || '5',
        10,
      ),
      mergeableRetryInterval: parseInt(
        core.getInput('mergeable_retry_interval') || '10',
        10,
      ),
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
    const result = await execMerge(octokit, context, config);

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

    writeSummary(
      resultEmoji,
      context.prNumber,
      context.actor,
      undefined, // headRef not available in this scope
      undefined, // baseRef not available in this scope
      result.mergeMethod,
      undefined, // headSha not available in this scope
    );

    // Log result
    core.info(`exec-merge result: ${result.status} - ${result.message}`);

    // Mark as failed if the result status is failed
    if (result.status === 'failed') {
      // Don't fail the workflow - failures are communicated via PR comments
      core.info(
        'Merge checks or operation failed. See PR comments for details.',
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    core.setFailed(`exec-merge action failed: ${message}`);
  }
}

// Run the action
run();
