import type { ActionConfig, ActionResult, EventContext, Octokit } from './types.js';

/**
 * MergeService interface defines the contract for executing merge automation.
 * This is the core service interface for the merge module.
 */
export interface MergeService {
  /**
   * Execute the merge action based on the provided context and configuration.
   * @param octokit - GitHub API client
   * @param context - Event context containing PR and comment information
   * @param config - Action configuration
   * @returns Result of the merge operation
   */
  executeAction(octokit: Octokit, context: EventContext, config: ActionConfig): Promise<ActionResult>;
}
