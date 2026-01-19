/**
 * main.ts - Entry point for the lysbot-merge GitHub Action
 *
 * This file is the main entry point that runs in the GitHub Actions environment.
 * It is responsible for:
 * 1. Reading inputs from the GitHub Actions environment
 * 2. Parsing configuration from action inputs
 * 3. Constructing the event context from github.context
 * 4. Delegating to executeAction() for business logic
 * 5. Writing outputs and summaries
 *
 * DESIGN PATTERN:
 * ===============
 * This module uses Dependency Injection (DI) with clear boundaries:
 * - Dependencies are injected via an optional RunDependencies parameter (defaults to production dependencies)
 * - Wiring logic is isolated in createProductionDependencies()
 * - Environment configuration is centralized in resolveRuntimeEnvironment()
 * - All dependencies are at maximum granularity with minimal interfaces:
 *   - ActionsCore: Only the methods actually used from @actions/core
 *   - GitHubContext: GitHub context data
 *   - getOctokit: The actual function (not wrapped in an object)
 *   - RuntimeEnvironment: Environment configuration
 * - Tests inject test doubles; production uses actual modules/functions
 *
 * The core business logic remains in action.ts (executeAction, buildSummaryMarkdown)
 * which has comprehensive test coverage independent of GitHub Actions runtime.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';

import { executeAction, buildSummaryMarkdown } from './action.js';
import type { ActionConfig, EventContext, RunDependencies, RuntimeEnvironment } from './types.js';

/**
 * Resolves runtime environment configuration.
 * Centralizes environment variable access for better maintainability.
 *
 * @returns Runtime environment configuration
 */
function resolveRuntimeEnvironment(): RuntimeEnvironment {
  return {
    serverUrl: process.env.GITHUB_SERVER_URL ?? 'https://github.com',
  };
}

/**
 * Wires up dependencies for production execution.
 * This function encapsulates the "wiring" logic, keeping run() focused on orchestration.
 * Dependencies are injected at maximum granularity:
 * - core: Actual @actions/core module (satisfies ActionsCore interface)
 * - context: github.context object
 * - getOctokit: github.getOctokit function (not the entire module)
 * - env: Resolved runtime environment
 *
 * @returns Production dependencies
 */
function createProductionDependencies(): RunDependencies {
  return {
    core,
    context: github.context,
    getOctokit: github.getOctokit,
    env: resolveRuntimeEnvironment(),
  };
}

/**
 * Main function that runs the action.
 *
 * This function orchestrates the action execution:
 * 1. Reads inputs from GitHub Actions environment
 * 2. Parses configuration from action inputs
 * 3. Constructs the event context from github.context
 * 4. Delegates to executeAction() for business logic
 * 5. Writes outputs and summaries
 *
 * Dependencies are injected at a granular level to enable testing without mocks (DI/DIP pattern).
 *
 * @param deps - Dependencies for GitHub Actions integration (defaults to production)
 */
export async function run(deps: RunDependencies = createProductionDependencies()): Promise<void> {
  try {
    // Get inputs
    const token = deps.core.getInput('github-token', { required: true });

    // Parse integer inputs with safety checks
    const retryCountInput = deps.core.getInput('mergeable_retry_count') || '5';
    const retryIntervalInput = deps.core.getInput('mergeable_retry_interval') || '10';
    const mergeableRetryCount = parseInt(retryCountInput, 10);
    const mergeableRetryInterval = parseInt(retryIntervalInput, 10);

    // Validate parsed integers and fall back to defaults if NaN
    const config: ActionConfig = {
      releaseBranchPrefix: deps.core.getInput('release_branch_prefix') || 'release/',
      developBranch: deps.core.getInput('develop_branch') || 'develop',
      syncBranchPrefix: deps.core.getInput('sync_branch_prefix') || 'fix/sync/',
      mergeableRetryCount: Number.isNaN(mergeableRetryCount) ? 5 : mergeableRetryCount,
      mergeableRetryInterval: Number.isNaN(mergeableRetryInterval) ? 10 : mergeableRetryInterval,
    };

    // Get event context
    //
    // Note:
    //   - github.context.payload is intentionally typed as unknown, so some property accesses
    //     cannot be made fully type-safe. In those cases, we selectively disable ESLint on specific
    //     lines rather than adding noisy type assertions.
    const payload = deps.context.payload;

    // Build event context
    const context: EventContext = {
      owner: deps.context.repo.owner,
      repo: deps.context.repo.repo,
      // prNumber will be 0 if this is not a PR comment, but that's acceptable
      // because executeAction() will skip early when isPullRequest is false
      prNumber: payload.issue?.number ?? 0,
      commentId: payload.comment?.id ?? 0,

      commentBody: payload.comment?.body ?? '',
      actor: deps.context.actor,

      userType: payload.comment?.user?.type ?? 'User',

      authorAssociation: payload.comment?.author_association ?? 'NONE',
      serverUrl: deps.env.serverUrl,
      runId: deps.context.runId,
      eventName: deps.context.eventName,
      isPullRequest: !!payload.issue?.pull_request,
    };

    // Create Octokit instance
    const octokit = deps.getOctokit(token);

    // Run the main logic
    const result = await executeAction(octokit, context, config);

    // Set outputs
    deps.core.setOutput('result', result.status);
    if (result.mergeMethod) {
      deps.core.setOutput('merge_method', result.mergeMethod);
    }

    // Write summary
    const resultEmoji = {
      merged: '✅ Merged successfully',
      skipped: '⏭️ Skipped',
      failed: '❌ Failed',
      already_merged: 'ℹ️ Already merged',
    }[result.status];

    const summaryMarkdown = buildSummaryMarkdown(resultEmoji, context.prNumber, context.actor, result.mergeMethod);
    await deps.core.summary.addRaw(summaryMarkdown).write();

    // Log result
    deps.core.info(`lysbot-merge result: ${result.status} - ${result.message}`);

    // Mark as failed if the result status is failed
    if (result.status === 'failed') {
      // Don't fail the workflow - failures are communicated via PR comments
      deps.core.info('Merge checks or operation failed. See PR comments for details.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    deps.core.setFailed(`lysbot-merge action failed: ${message}`);
  }
}
