import type { ActionConfig, ActionResult, EventContext, Octokit } from './types.js';

export interface ActionRunner {
  executeAction(octokit: Octokit, context: EventContext, config: ActionConfig): Promise<ActionResult>;
  buildSummaryMarkdown(result: string, prNumber: number, actor: string, mergeMethod?: string): string;
}

export function createActionRunner(dependencies: {
  executeAction: (octokit: Octokit, context: EventContext, config: ActionConfig) => Promise<ActionResult>;
  buildSummaryMarkdown: (result: string, prNumber: number, actor: string, mergeMethod?: string) => string;
}): ActionRunner {
  return {
    executeAction: dependencies.executeAction,
    buildSummaryMarkdown: dependencies.buildSummaryMarkdown,
  };
}
