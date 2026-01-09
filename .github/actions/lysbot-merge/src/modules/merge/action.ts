/**
 * action.ts - Action entry point for the merge module
 *
 * This file handles input/output mapping between GitHub Actions and the app layer.
 * It translates GitHub-specific strings to domain-friendly types.
 * 
 * ARCHITECTURE: This is the ACTION layer - it can import from @actions/* and app,
 * but should delegate business logic to the app layer.
 */

import type { IActionsCore } from '../../shared/infra-shared/index.js';
import type { EventContext, MergeResult } from './app.js';
import { MergeAppService, type MergeAppDependencies } from './app.js';
import type { ActionConfig } from './domain.js';
import { parseCommand } from './domain.js';

/**
 * Runs the merge action.
 * 
 * @param core - Actions core wrapper
 * @param context - Event context from GitHub
 * @param deps - Application dependencies (injected by main.ts)
 * @returns Result of the merge operation
 */
export async function runMergeAction(
  core: IActionsCore,
  context: EventContext,
  deps: MergeAppDependencies,
): Promise<MergeResult> {
  try {
    // Parse configuration from inputs (already done by main.ts, passed in context)
    // But we need to get it again here for the action config
    const config: ActionConfig = {
      releaseBranchPrefix: core.getInput('release_branch_prefix') || 'release/',
      developBranch: core.getInput('develop_branch') || 'develop',
      syncBranchPrefix: core.getInput('sync_branch_prefix') || 'fix/sync/',
      mergeableRetryCount: parseInt(core.getInput('mergeable_retry_count') || '5', 10),
      mergeableRetryInterval: parseInt(core.getInput('mergeable_retry_interval') || '10', 10),
    };

    // Parse merge command options from comment body
    const mergeOptions = parseCommand(context.commentBody);
    if (!mergeOptions) {
      return {
        status: 'skipped',
        message: 'Command not matched',
      };
    }

    // Create app service and execute
    const appService = new MergeAppService(deps);
    const result = await appService.execute({
      context,
      config,
      mergeOptions,
    });

    // Return the result (caller will handle setting outputs)
    if (result.ok) {
      return result.value;
    } else {
      // This shouldn't happen with current implementation, but handle it anyway
      return {
        status: 'failed',
        message: result.error,
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    core.error(`Merge action failed: ${message}`);
    return {
      status: 'failed',
      message: `Internal error: ${message}`,
    };
  }
}

/**
 * Builds a summary markdown table for the merge operation.
 * This is a pure helper function for formatting output.
 */
export function buildSummaryMarkdown(
  result: string,
  prNumber: number,
  actor: string,
  mergeMethod?: string,
): string {
  let summary = `## lysbot-merge Summary\n\n`;
  summary += `| Item | Value |\n`;
  summary += `|------|-------|\n`;
  summary += `| **Result** | ${result} |\n`;
  summary += `| **PR** | #${prNumber} |\n`;
  summary += `| **Triggered by** | @${actor} |\n`;

  if (mergeMethod) {
    summary += `| **Merge Method** | \`${mergeMethod}\` |\n`;
  }

  return summary;
}
