import * as core from '@actions/core';
import * as github from '@actions/github';

import { buildSummaryMarkdown } from '../../formatting/markdown.js';
import type { ActionConfig, ActionResult, EventContext } from '../../types/index.js';

/**
 * I/O Adapter - Handles all GitHub Actions I/O operations
 * Isolates @actions/core and @actions/github dependencies
 */

export function readConfig(): ActionConfig {
  return {
    releaseBranchPrefix: core.getInput('release_branch_prefix') || 'release/',
    developBranch: core.getInput('develop_branch') || 'develop',
    syncBranchPrefix: core.getInput('sync_branch_prefix') || 'fix/sync/',
    mergeableRetryCount: parseInt(core.getInput('mergeable_retry_count') || '5', 10),
    mergeableRetryInterval: parseInt(core.getInput('mergeable_retry_interval') || '10', 10),
  };
}

export function readToken(): string {
  return core.getInput('github-token', { required: true });
}

export function readContext(): EventContext {
  const payload = github.context.payload as {
    issue?: { number?: number; pull_request?: unknown };
    comment?: { id?: number; body?: string; user?: { type?: string }; author_association?: string };
  };

  return {
    owner: github.context.repo.owner,
    repo: github.context.repo.repo,
    prNumber: payload.issue?.number ?? 0,
    commentId: payload.comment?.id ?? 0,
    commentBody: payload.comment?.body ?? '',
    actor: github.context.actor,
    userType: payload.comment?.user?.type ?? 'User',
    authorAssociation: payload.comment?.author_association ?? 'NONE',
    serverUrl: process.env.GITHUB_SERVER_URL ?? 'https://github.com',
    runId: github.context.runId,
    eventName: github.context.eventName,
    isPullRequest: !!payload.issue?.pull_request,
  };
}

export function createOctokit(token: string) {
  return github.getOctokit(token);
}

export function writeOutputs(result: ActionResult): void {
  core.setOutput('result', result.status);
  if (result.mergeMethod) {
    core.setOutput('merge_method', result.mergeMethod);
  }
}

export async function writeSummary(result: ActionResult, context: EventContext): Promise<void> {
  const resultEmoji = {
    merged: '✅ Merged successfully',
    skipped: '⏭️ Skipped',
    failed: '❌ Failed',
    already_merged: 'ℹ️ Already merged',
  }[result.status];

  const summaryMarkdown = buildSummaryMarkdown(resultEmoji, context.prNumber, context.actor, result.mergeMethod);
  await core.summary.addRaw(summaryMarkdown).write();
}

export function logResult(result: ActionResult): void {
  core.info(`lysbot-merge result: ${result.status} - ${result.message}`);

  if (result.status === 'failed') {
    core.info('Merge checks or operation failed. See PR comments for details.');
  }
}

export function logError(error: unknown): void {
  const message = error instanceof Error ? error.message : 'Unknown error';
  core.setFailed(`lysbot-merge action failed: ${message}`);
}
