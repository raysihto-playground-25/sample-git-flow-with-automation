/**
 * action-runner.ts - Internal implementation of the ActionRunner interface
 *
 * This file contains the concrete implementation that wires GitHub Actions
 * runtime integration with the business logic.
 */

import type { ActionRunner, CoreDependencies, GitHubDependencies } from '../index.js';

import { executeAction, buildSummaryMarkdown } from './action.js';
import type { ActionConfig, EventContext } from './types.js';

/**
 * Creates an ActionRunner instance with the provided dependencies.
 * This is the factory function called by the configurator.
 *
 * @param core - GitHub Actions core dependencies
 * @param github - GitHub Actions github dependencies
 * @returns ActionRunner instance
 */
export function createActionRunner(core: CoreDependencies, github: GitHubDependencies): ActionRunner {
  return {
    async run(): Promise<void> {
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
    },
  };
}
