/**
 * main.ts - Composition Root for lysbot-merge GitHub Action
 *
 * This file is the Composition Root where all Dependency Injection (Pure DI) occurs.
 * It is responsible for:
 * 1. Manual DI: Creating and assembling all dependencies
 * 2. Invoking the action: Calling entry functions from modules
 *
 * Following the Lightweight Modular Monolith architecture:
 * - NO business logic here
 * - NO input/output handling here (delegated to ACTION layer)
 * - ONLY DI assembly and function invocation
 */

import * as core from '@actions/core';
import * as github from '@actions/github';

import {
  readActionInputs,
  buildEventContext,
  writeActionOutputs,
  writeActionSummary,
  executeMerge,
  GitHubAdapter,
} from './modules/lysbot-merge/index.js';

/**
 * Main function that runs the action.
 *
 * This function performs Pure DI:
 * 1. Creates dependencies (Octokit, GitHubAdapter)
 * 2. Reads inputs and context using ACTION layer functions
 * 3. Invokes the APP layer function (executeMerge)
 * 4. Writes outputs using ACTION layer functions
 */
export async function run(): Promise<void> {
  try {
    // Read GitHub token
    const token = core.getInput('github-token', { required: true });

    // Create Octokit instance (infrastructure dependency)
    const octokit = github.getOctokit(token);

    // Read configuration from ACTION layer
    const config = readActionInputs();

    // Build event context from ACTION layer
    const context = buildEventContext();

    // Create GitHub adapter (DI: inject Octokit and context)
    const githubAdapter = new GitHubAdapter(octokit, context.owner, context.repo);

    // Execute main logic (DI: inject adapter, context, config)
    const result = await executeMerge(githubAdapter, context, config);

    // Write outputs using ACTION layer
    writeActionOutputs(result);

    // Write summary using ACTION layer
    await writeActionSummary(result, context.prNumber, context.actor);

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
