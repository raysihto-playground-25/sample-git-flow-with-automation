import type { ActionDependencies } from './dependencies.js';
import { createProductionDependencies } from './dependencies.js';
import { buildSummaryMarkdown, executeAction } from './tmp_anything.js';
import type { ActionConfig, EventContext } from './tmp_anything.js';

export async function run(deps?: ActionDependencies): Promise<void> {
  const resolvedDeps = deps ?? (await createProductionDependencies());

  try {
    const token = resolvedDeps.core.getInput('github-token', { required: true });
    const config: ActionConfig = {
      releaseBranchPrefix: resolvedDeps.core.getInput('release_branch_prefix') || 'release/',
      developBranch: resolvedDeps.core.getInput('develop_branch') || 'develop',
      syncBranchPrefix: resolvedDeps.core.getInput('sync_branch_prefix') || 'fix/sync/',
      mergeableRetryCount: parseInt(resolvedDeps.core.getInput('mergeable_retry_count') || '5', 10),
      mergeableRetryInterval: parseInt(resolvedDeps.core.getInput('mergeable_retry_interval') || '10', 10),
    };

    const payload = resolvedDeps.github.context.payload;
    const context: EventContext = {
      owner: resolvedDeps.github.context.repo.owner,
      repo: resolvedDeps.github.context.repo.repo,
      prNumber: payload.issue?.number ?? 0,
      commentId: payload.comment?.id ?? 0,

      commentBody: payload.comment?.body ?? '',
      actor: resolvedDeps.github.context.actor,

      userType: payload.comment?.user?.type ?? 'User',

      authorAssociation: payload.comment?.author_association ?? 'NONE',
      serverUrl: process.env.GITHUB_SERVER_URL ?? 'https://github.com',
      runId: resolvedDeps.github.context.runId,
      eventName: resolvedDeps.github.context.eventName,
      isPullRequest: !!payload.issue?.pull_request,
    };

    const octokit = resolvedDeps.github.getOctokit(token);
    const result = await executeAction(octokit, context, config);

    resolvedDeps.core.setOutput('result', result.status);
    if (result.mergeMethod) {
      resolvedDeps.core.setOutput('merge_method', result.mergeMethod);
    }

    const resultEmoji = {
      merged: '✅ Merged successfully',
      skipped: '⏭️ Skipped',
      failed: '❌ Failed',
      already_merged: 'ℹ️ Already merged',
    }[result.status];

    const summaryMarkdown = buildSummaryMarkdown(resultEmoji, context.prNumber, context.actor, result.mergeMethod);
    await resolvedDeps.core.summary.addRaw(summaryMarkdown).write();

    resolvedDeps.core.info(`lysbot-merge result: ${result.status} - ${result.message}`);
    if (result.status === 'failed') {
      resolvedDeps.core.info('Merge checks or operation failed. See PR comments for details.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    resolvedDeps.core.setFailed(`lysbot-merge action failed: ${message}`);
  }
}
