// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type * as core from '@actions/core';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type * as github from '@actions/github';

import { ActionRunner } from './internal/action-runner.js';

// Re-export public types
export type { ActionConfig, EventContext, ActionResult } from './internal/types.js';

// Re-export constants for testing
export { COMMAND_REGEX, CONVENTIONAL_COMMIT_REGEX, CONVENTIONAL_COMMIT_TYPES, TWEMOJI } from './internal/constants.js';

// Re-export validation functions for testing
export {
  parseCommand,
  isBot,
  hasValidAuthorAssociation,
  hasValidPermission,
  isConventionalCommitTitle,
  determineMergeMethod,
  validatePRState,
  getMergeableStateDescription,
} from './internal/validation.js';

// Re-export formatting functions for testing
export { buildCheckResultsMarkdown, buildSummaryMarkdown, waitBeforeRetryMs } from './internal/formatting.js';

// Public API
export interface ActionModule {
  actionRunner: ActionRunner;
}

export function configureActionModule(core: typeof core, github: typeof github): ActionModule {
  // Note: Configuration is lazy - octokit and config are created by ActionRunner when run() is called
  // This allows proper error handling and test mocking
  const runner = new ActionRunner(core, github);

  return {
    actionRunner: runner,
  };
}
