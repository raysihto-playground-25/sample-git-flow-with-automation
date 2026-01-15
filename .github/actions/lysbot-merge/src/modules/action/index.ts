import { buildSummaryMarkdown, executeAction } from './internal/action-executor.js';
import type { ActionRunner } from './internal/action-runner.js';
import { createActionRunner } from './internal/action-runner.js';

export type { ActionConfig, ActionResult, EventContext, Octokit } from './internal/types.js';
export type { ActionRunner } from './internal/action-runner.js';

export function configureActionModule(): ActionRunner {
  return createActionRunner({
    executeAction,
    buildSummaryMarkdown,
  });
}
