/**
 * main-new.ts - Entry point and composition root for the lysbot-merge GitHub Action
 *
 * This file is the main entry point and serves as the composition root for dependency injection.
 * It is responsible for:
 * 1. Reading inputs from the GitHub Actions environment
 * 2. Constructing all dependencies (adapters, services, use cases)
 * 3. Wiring dependencies using Pure DI
 * 4. Calling the use case
 * 5. Setting outputs and writing summaries
 *
 * This is the ONLY file where concrete adapters are instantiated.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';

import { MergeUseCase } from './usecases/merge/MergeUseCase.js';
import type { MergeConfig, EventContext } from './usecases/merge/MergeUseCaseInput.js';
import { GitHubClient } from './adapters/gateways/GitHubClient.js';
import { ActionLogger } from './adapters/gateways/ActionLogger.js';
import { SummaryPresenter } from './adapters/presenters/SummaryPresenter.js';

/**
 * Main function that runs the action.
 *
 * This function acts as the composition root:
 * 1. Reads inputs from GitHub Actions environment
 * 2. Constructs all adapters and use cases
 * 3. Delegates business logic to the use case
 * 4. Writes outputs to GitHub Actions environment
 */
export async function run(): Promise<void> {
  try {
    // =========================================================================
    // Step 1: Read inputs from GitHub Actions environment
    // =========================================================================

    const token = core.getInput('github-token', { required: true });
    
    const config: MergeConfig = {
      releaseBranchPrefix: core.getInput('release_branch_prefix') || 'release/',
      developBranch: core.getInput('develop_branch') || 'develop',
      syncBranchPrefix: core.getInput('sync_branch_prefix') || 'fix/sync/',
      mergeableRetryCount: parseInt(core.getInput('mergeable_retry_count') || '5', 10),
      mergeableRetryInterval: parseInt(core.getInput('mergeable_retry_interval') || '10', 10),
    };

    // Get event context from GitHub Actions runtime
    const payload = github.context.payload;

    const context: EventContext = {
      prNumber: payload.issue?.number ?? 0,
      commentId: payload.comment?.id ?? 0,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      commentBody: payload.comment?.body ?? '',
      actor: github.context.actor,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      userType: payload.comment?.user?.type ?? 'User',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      authorAssociation: payload.comment?.author_association ?? 'NONE',
      eventName: github.context.eventName,
      isPullRequest: !!payload.issue?.pull_request,
    };

    // =========================================================================
    // Step 2: Construct adapters (Infrastructure Layer)
    // =========================================================================

    const octokit = github.getOctokit(token);
    const gitHubClient = new GitHubClient(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      octokit as any,
      github.context.repo.owner,
      github.context.repo.repo,
    );
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const logger = new ActionLogger(core as any);

    // =========================================================================
    // Step 3: Construct use case (Application Layer)
    // =========================================================================

    const mergeUseCase = new MergeUseCase(gitHubClient, logger, config);

    // =========================================================================
    // Step 4: Execute the use case
    // =========================================================================

    const result = await mergeUseCase.execute(context, config);

    // =========================================================================
    // Step 5: Write outputs to GitHub Actions environment
    // =========================================================================

    core.setOutput('result', result.status);
    if (result.mergeMethod) {
      core.setOutput('merge_method', result.mergeMethod);
    }

    // Write summary
    const presenter = new SummaryPresenter();
    const resultEmoji = {
      merged: '✅ Merged successfully',
      skipped: '⏭️ Skipped',
      failed: '❌ Failed',
      already_merged: 'ℹ️ Already merged',
    }[result.status];

    const summaryMarkdown = presenter.buildSummaryMarkdown(resultEmoji, context.prNumber, context.actor, result.mergeMethod);
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
