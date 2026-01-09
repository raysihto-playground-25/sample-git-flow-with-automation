/**
 * main.ts - Composition Root for the lysbot-merge GitHub Action
 *
 * This file is the **ONLY** place where all layers are coupled together.
 * It acts as the Composition Root for Dependency Injection.
 *
 * Responsibilities:
 * 1. Reading inputs from the GitHub Actions environment
 * 2. Instantiating adapters (OctokitGitHubClient, ActionLogger)
 * 3. Instantiating use cases with their dependencies
 * 4. Executing the use case
 * 5. Setting outputs and writing summaries
 *
 * Following Clean Architecture:
 * - Domain layer: Pure business logic (no dependencies)
 * - Usecases layer: Application workflows (depends on domain only)
 * - Adapters layer: External integrations (implements use case ports)
 * - Main.ts: Wires everything together (the only place with cross-layer knowledge)
 */

import * as core from '@actions/core';
import * as github from '@actions/github';

import { ActionLogger } from './adapters/gateways/ActionLogger.js';
import { OctokitGitHubClient } from './adapters/gateways/OctokitGitHubClient.js';
import { SummaryPresenter } from './adapters/presenters/SummaryPresenter.js';
import type { MergePullRequestInput } from './usecases/merge/MergePullRequestDTO.js';
import { MergePullRequestUseCase } from './usecases/merge/MergePullRequestUseCase.js';

/**
 * Main function that runs the action.
 *
 * This is the Composition Root where Dependency Injection happens.
 * Following Clean Architecture principles:
 * 1. Setup Adapters (Infrastructure) - instantiate gateways and presenters
 * 2. Setup UseCase (Application Logic) - inject dependencies
 * 3. Execute - run the use case with input data
 * 4. Output - write results to GitHub Actions environment
 */
export async function run(): Promise<void> {
  try {
    // -------------------------------------------------------------------------
    // Step 1: Read inputs from GitHub Actions environment
    // -------------------------------------------------------------------------
    const token = core.getInput('github-token', { required: true });

    const mergeConfig = {
      releaseBranchPrefix: core.getInput('release_branch_prefix') || 'release/',
      developBranch: core.getInput('develop_branch') || 'develop',
      syncBranchPrefix: core.getInput('sync_branch_prefix') || 'fix/sync/',
    };

    const retryConfig = {
      mergeableRetryCount: parseInt(core.getInput('mergeable_retry_count') || '5', 10),
      mergeableRetryInterval: parseInt(core.getInput('mergeable_retry_interval') || '10', 10),
    };

    // Get event context
    const payload = github.context.payload;

    const input: MergePullRequestInput = {
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
      eventName: github.context.eventName,
      isPullRequest: !!payload.issue?.pull_request,
      mergeConfig,
      retryConfig,
    };

    // -------------------------------------------------------------------------
    // Step 2: Setup Adapters (Infrastructure Layer)
    // -------------------------------------------------------------------------
    const octokit = github.getOctokit(token);
    const githubClient = new OctokitGitHubClient(octokit);
    const logger = new ActionLogger();
    const summaryPresenter = new SummaryPresenter();

    // -------------------------------------------------------------------------
    // Step 3: Setup UseCase (Application Layer) with Dependency Injection
    // -------------------------------------------------------------------------
    const mergePRUseCase = new MergePullRequestUseCase(githubClient, logger);

    // -------------------------------------------------------------------------
    // Step 4: Execute the UseCase
    // -------------------------------------------------------------------------
    const result = await mergePRUseCase.execute(input);

    // -------------------------------------------------------------------------
    // Step 5: Write outputs to GitHub Actions environment
    // -------------------------------------------------------------------------
    core.setOutput('result', result.status);
    if (result.mergeMethod) {
      core.setOutput('merge_method', result.mergeMethod);
    }

    // Build and write summary using presenter
    const resultEmoji = {
      merged: '✅ Merged successfully',
      skipped: '⏭️ Skipped',
      failed: '❌ Failed',
      already_merged: 'ℹ️ Already merged',
    }[result.status];

    const summaryMarkdown = summaryPresenter.buildSummary(resultEmoji, input.prNumber, input.actor, result.mergeMethod);
    await core.summary.addRaw(summaryMarkdown).write();

    // Log result
    logger.info(`lysbot-merge result: ${result.status} - ${result.message}`);

    // Don't fail the workflow - failures are communicated via PR comments
    if (result.status === 'failed') {
      logger.info('Merge checks or operation failed. See PR comments for details.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    core.setFailed(`lysbot-merge action failed: ${message}`);
  }
}
