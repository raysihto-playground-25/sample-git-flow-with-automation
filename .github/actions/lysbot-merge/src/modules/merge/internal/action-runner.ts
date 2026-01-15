import type { CoreAdapter, GitHubAdapter } from './adapters.js';
import { buildSummaryMarkdown } from './formatters.js';
import type { MergeService } from './merge-service.js';
import type { ActionConfig, ActionResult, EventContext, Octokit } from './types.js';

export interface ActionRunnerDeps {
  core: CoreAdapter;
  github: GitHubAdapter;
  mergeService: MergeService;
}

export interface ActionRunner {
  run(): Promise<void>;
}

export class DefaultActionRunner implements ActionRunner {
  constructor(private deps: ActionRunnerDeps) {}

  async run(): Promise<void> {
    const { core, github, mergeService } = this.deps;

    try {
      const token = core.getInput('github-token', { required: true });
      const config: ActionConfig = {
        releaseBranchPrefix: core.getInput('release_branch_prefix') || 'release/',
        developBranch: core.getInput('develop_branch') || 'develop',
        syncBranchPrefix: core.getInput('sync_branch_prefix') || 'fix/sync/',
        mergeableRetryCount: parseInt(core.getInput('mergeable_retry_count') || '5', 10),
        mergeableRetryInterval: parseInt(core.getInput('mergeable_retry_interval') || '10', 10),
      };

      const payload = github.context.payload;
      const context: EventContext = {
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

      const octokit = github.getOctokit(token) as Octokit;

      const result: ActionResult = await mergeService.executeAction(octokit, context, config);

      core.setOutput('result', result.status);
      if (result.mergeMethod) {
        core.setOutput('merge_method', result.mergeMethod);
      }

      const resultEmoji = {
        merged: '✅ Merged successfully',
        skipped: '⏭️ Skipped',
        failed: '❌ Failed',
        already_merged: 'ℹ️ Already merged',
      }[result.status];

      const summaryMarkdown = buildSummaryMarkdown(resultEmoji, context.prNumber, context.actor, result.mergeMethod);
      await core.summary.addRaw(summaryMarkdown).write();

      core.info(`lysbot-merge result: ${result.status} - ${result.message}`);
      if (result.status === 'failed') {
        core.info('Merge checks or operation failed. See PR comments for details.');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      core.setFailed(`lysbot-merge action failed: ${message}`);
    }
  }
}
