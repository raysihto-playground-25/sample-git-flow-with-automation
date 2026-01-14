/**
 * Presentation layer: Formats outputs and handles user-facing concerns
 */

import type { ActionDependencies } from './dependencies.js';
import type { ActionResult } from './tmp_anything.js';
import { buildSummaryMarkdown } from './tmp_anything.js';

/**
 * Map action result status to user-friendly emoji message
 */
function getResultEmoji(status: ActionResult['status']): string {
  const emojiMap = {
    merged: '✅ Merged successfully',
    skipped: '⏭️ Skipped',
    failed: '❌ Failed',
    already_merged: 'ℹ️ Already merged',
  };
  return emojiMap[status];
}

/**
 * Present action result to user via GitHub Actions outputs and summary
 */
export async function presentResult(
  deps: ActionDependencies,
  result: ActionResult,
  prNumber: number,
  actor: string,
): Promise<void> {
  // Set outputs
  deps.core.setOutput('result', result.status);
  if (result.mergeMethod) {
    deps.core.setOutput('merge_method', result.mergeMethod);
  }

  // Write summary
  const resultEmoji = getResultEmoji(result.status);
  const summaryMarkdown = buildSummaryMarkdown(resultEmoji, prNumber, actor, result.mergeMethod);
  await deps.core.summary.addRaw(summaryMarkdown).write();

  // Log result
  deps.core.info(`lysbot-merge result: ${result.status} - ${result.message}`);
  if (result.status === 'failed') {
    deps.core.info('Merge checks or operation failed. See PR comments for details.');
  }
}

/**
 * Present error to user
 */
export function presentError(deps: ActionDependencies, error: unknown): void {
  const message = error instanceof Error ? error.message : 'Unknown error';
  deps.core.setFailed(`lysbot-merge action failed: ${message}`);
}
