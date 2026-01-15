import type * as core from '@actions/core';
import type * as github from '@actions/github';

import type { ActionRunner } from './internal/action-runner.js';
import { createActionRunner } from './internal/action-runner.js';

// Re-export public types for consumers
export type {
  ActionConfig,
  ActionResult,
  CheckResult,
  EventContext,
  MergeMethodResult,
  MergeOptions,
  Octokit,
  PullRequestData,
  Review,
  ReviewsArray,
} from './internal/types.js';

// Re-export public constants
export {
  COMMAND_REGEX,
  CONVENTIONAL_COMMIT_REGEX,
  CONVENTIONAL_COMMIT_TYPES,
  TWEMOJI,
  VALID_AUTHOR_ASSOCIATIONS,
  VALID_FLAGS,
  VALID_PERMISSIONS,
} from './internal/constants.js';

// Re-export validation functions (for testing)
export {
  buildCheckResultsMarkdown,
  determineMergeMethod,
  getMergeableStateDescription,
  hasValidAuthorAssociation,
  hasValidPermission,
  isBot,
  isConventionalCommitTitle,
  parseCommand,
  validatePRState,
  waitBeforeRetryMs,
} from './internal/validation.js';

// Re-export GitHub API functions (for testing)
export { addReaction, getCollaboratorPermission, postComment } from './internal/github-api.js';

// Re-export pull request functions (for testing)
export {
  countUnresolvedThreads,
  dismissReview,
  fetchApprovedReviews,
  fetchPullRequestCommits,
  fetchPullRequestData,
  mergePullRequest,
} from './internal/pull-request.js';

// Re-export action executor (for testing)
export { buildSummaryMarkdown, executeAction } from './internal/action-executor.js';

// Public API shape
export interface ActionModule {
  actionRunner: ActionRunner;
}

/**
 * Configurator function that wires up the action module.
 * This is the composition root for the action module.
 */
export function configureActionModule(coreModule: typeof core, githubModule: typeof github): ActionModule {
  const token = coreModule.getInput('github-token', { required: true });
  const octokit = githubModule.getOctokit(token);

  const actionRunner = createActionRunner(coreModule, githubModule.context, octokit);

  return {
    actionRunner,
  };
}
