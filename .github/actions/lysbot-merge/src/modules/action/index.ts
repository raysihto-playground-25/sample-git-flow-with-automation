/**
 * Action Module - Public API
 *
 * This module represents the lysbot-merge GitHub Action's core functionality.
 * It follows Pure DI principles and exports only interfaces and the configurator.
 */

import type * as core from '@actions/core';
import type * as github from '@actions/github';

import { createActionRunner } from './internal/action-runner.js';

/**
 * Runner interface for executing the action.
 * This provides a clear entry point for the action execution.
 */
export interface ActionRunner {
  run(): Promise<void>;
}

/**
 * Dependencies from @actions/core
 */
export interface CoreDependencies {
  getInput(name: string, options?: core.InputOptions): string;
  setOutput(name: string, value: unknown): void;
  setFailed(message: string | Error): void;
  info(message: string): void;
  summary: typeof core.summary;
}

/**
 * Dependencies from @actions/github
 */
export interface GitHubDependencies {
  context: typeof github.context;
  getOctokit(token: string): ReturnType<typeof github.getOctokit>;
}

/**
 * The public API exposed by this module
 */
export interface ActionModule {
  actionRunner: ActionRunner;
}

/**
 * Configurator function that wires up the action module.
 * This is the only place where concrete implementations are instantiated.
 *
 * @param core - GitHub Actions core dependencies
 * @param github - GitHub Actions github dependencies
 * @returns The configured action module
 */
export function configureActionModule(core: CoreDependencies, github: GitHubDependencies): ActionModule {
  // Wire up the action runner with its dependencies
  const actionRunner = createActionRunner(core, github);

  return {
    actionRunner,
  };
}
