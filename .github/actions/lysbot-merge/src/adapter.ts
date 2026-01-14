/**
 * Adapter layer: Converts external inputs to internal domain objects
 */

import type { ActionDependencies } from './dependencies.js';
import type { ActionConfig, EventContext } from './tmp_anything.js';

/**
 * Build ActionConfig from GitHub Actions inputs
 */
export function buildConfigFromInputs(deps: ActionDependencies): ActionConfig {
  return {
    releaseBranchPrefix: deps.core.getInput('release_branch_prefix') || 'release/',
    developBranch: deps.core.getInput('develop_branch') || 'develop',
    syncBranchPrefix: deps.core.getInput('sync_branch_prefix') || 'fix/sync/',
    mergeableRetryCount: parseInt(deps.core.getInput('mergeable_retry_count') || '5', 10),
    mergeableRetryInterval: parseInt(deps.core.getInput('mergeable_retry_interval') || '10', 10),
  };
}

/**
 * Build EventContext from GitHub context and payload
 */
export function buildEventContext(deps: ActionDependencies): EventContext {
  const payload = deps.github.context.payload;

  return {
    owner: deps.github.context.repo.owner,
    repo: deps.github.context.repo.repo,
    prNumber: payload.issue?.number ?? 0,
    commentId: payload.comment?.id ?? 0,
    commentBody: payload.comment?.body ?? '',
    actor: deps.github.context.actor,
    userType: payload.comment?.user?.type ?? 'User',
    authorAssociation: payload.comment?.author_association ?? 'NONE',
    serverUrl: process.env.GITHUB_SERVER_URL ?? 'https://github.com',
    runId: deps.github.context.runId,
    eventName: deps.github.context.eventName,
    isPullRequest: !!payload.issue?.pull_request,
  };
}

/**
 * Get GitHub token from inputs
 */
export function getToken(deps: ActionDependencies): string {
  return deps.core.getInput('github-token', { required: true });
}
