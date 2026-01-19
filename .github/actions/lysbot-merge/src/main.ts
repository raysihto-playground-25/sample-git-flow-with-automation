/**
 * main.ts - Entry point for the lysbot-merge GitHub Action
 *
 * Orchestrates the GitHub Action execution with clear separation of concerns:
 * - Dependency wiring (createProductionDependencies)
 * - Configuration parsing (parseConfig)
 * - Context building (buildEventContext)
 * - Business logic delegation (executeAction)
 * - Output handling
 *
 * DESIGN PATTERN: Dependency Injection (DI/DIP)
 * - All dependencies injected via RunDependencies parameter
 * - Helper functions extract configuration and context building logic
 * - Minimal interfaces document actual dependencies
 * - Tests inject test doubles; production uses actual modules
 */

import * as core from '@actions/core';
import * as github from '@actions/github';

import { executeAction, buildSummaryMarkdown } from './action.js';
import type {
  ActionConfig,
  EventContext,
  RunDependencies,
  RuntimeEnvironment,
  ActionsCore,
  GitHubContext,
} from './types.js';

/**
 * Resolves runtime environment configuration.
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
 * Encapsulates dependency creation logic.
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
 * Parses and validates action configuration from inputs.
 * Ensures integer values are valid and within reasonable bounds.
 *
 * @param core - ActionsCore interface for reading inputs
 * @returns Validated action configuration
 */
function parseConfig(core: ActionsCore): ActionConfig {
  const retryCountInput = core.getInput('mergeable_retry_count') || '5';
  const retryIntervalInput = core.getInput('mergeable_retry_interval') || '10';

  let mergeableRetryCount = parseInt(retryCountInput, 10);
  let mergeableRetryInterval = parseInt(retryIntervalInput, 10);

  // Validate and sanitize retry count (default: 5, min: 1, max: 20)
  if (Number.isNaN(mergeableRetryCount) || mergeableRetryCount < 1 || mergeableRetryCount > 20) {
    mergeableRetryCount = 5;
  }

  // Validate and sanitize retry interval (default: 10, min: 1, max: 60)
  if (Number.isNaN(mergeableRetryInterval) || mergeableRetryInterval < 1 || mergeableRetryInterval > 60) {
    mergeableRetryInterval = 10;
  }

  return {
    releaseBranchPrefix: core.getInput('release_branch_prefix') || 'release/',
    developBranch: core.getInput('develop_branch') || 'develop',
    syncBranchPrefix: core.getInput('sync_branch_prefix') || 'fix/sync/',
    mergeableRetryCount,
    mergeableRetryInterval,
  };
}

/**
 * Builds event context from GitHub context payload.
 *
 * @param context - GitHub context from actions/github
 * @param env - Runtime environment configuration
 * @returns Event context for action execution
 */
function buildEventContext(context: GitHubContext, env: RuntimeEnvironment): EventContext {
  const payload = context.payload;

  return {
    owner: context.repo.owner,
    repo: context.repo.repo,
    prNumber: payload.issue?.number ?? 0,
    commentId: payload.comment?.id ?? 0,
    commentBody: payload.comment?.body ?? '',
    actor: context.actor,
    userType: payload.comment?.user?.type ?? 'User',
    authorAssociation: payload.comment?.author_association ?? 'NONE',
    serverUrl: env.serverUrl,
    runId: context.runId,
    eventName: context.eventName,
    isPullRequest: !!payload.issue?.pull_request,
  };
}

/**
 * Main function that runs the action.
 * Orchestrates configuration parsing, context building, and action execution.
 *
 * @param deps - Dependencies for GitHub Actions integration (defaults to production)
 */
export async function run(deps: RunDependencies = createProductionDependencies()): Promise<void> {
  try {
    const token = deps.core.getInput('github-token', { required: true });
    const config = parseConfig(deps.core);
    const context = buildEventContext(deps.context, deps.env);
    const octokit = deps.getOctokit(token);

    const result = await executeAction(octokit, context, config);

    deps.core.setOutput('result', result.status);
    if (result.mergeMethod) {
      deps.core.setOutput('merge_method', result.mergeMethod);
    }

    const resultEmoji = {
      merged: '✅ Merged successfully',
      skipped: '⏭️ Skipped',
      failed: '❌ Failed',
      already_merged: 'ℹ️ Already merged',
    }[result.status];

    const summaryMarkdown = buildSummaryMarkdown(resultEmoji, context.prNumber, context.actor, result.mergeMethod);
    await deps.core.summary.addRaw(summaryMarkdown).write();

    deps.core.info(`lysbot-merge result: ${result.status} - ${result.message}`);

    if (result.status === 'failed') {
      deps.core.info('Merge checks or operation failed. See PR comments for details.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const stack = error instanceof Error ? error.stack : undefined;

    deps.core.setFailed(`lysbot-merge action failed: ${message}`);
    if (stack) {
      deps.core.info(`Stack trace: ${stack}`);
    }
  }
}
