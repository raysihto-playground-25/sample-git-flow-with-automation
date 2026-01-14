/**
 * Dependency interfaces for DI/DIP implementation
 * These interfaces abstract external dependencies to enable testability
 */

import type * as core from '@actions/core';
import type * as github from '@actions/github';

/**
 * Core service interface - abstracts @actions/core functionality
 */
export interface CoreService {
  getInput: typeof core.getInput;
  setOutput: typeof core.setOutput;
  setFailed: typeof core.setFailed;
  warning: typeof core.warning;
  info: typeof core.info;
  summary: {
    addRaw: typeof core.summary.addRaw;
    write: typeof core.summary.write;
  };
}

/**
 * GitHub context interface - abstracts @actions/github context
 */
export interface GitHubContext {
  repo: {
    owner: string;
    repo: string;
  };
  actor: string;
  runId: number;
  eventName: string;
  payload: {
    issue?: {
      number?: number;
      pull_request?: unknown;
    };
    comment?: {
      id?: number;
      body?: string;
      user?: {
        type?: string;
      };
      author_association?: string;
    };
  };
}

/**
 * GitHub service interface - abstracts @actions/github functionality
 */
export interface GitHubService {
  context: GitHubContext;
  getOctokit: typeof github.getOctokit;
}

/**
 * Dependencies container for the action
 */
export interface ActionDependencies {
  core: CoreService;
  github: GitHubService;
}

/**
 * Create production dependencies using real @actions/core and @actions/github
 *
 * Note: We use dynamic require() instead of ES6 imports to avoid importing
 * these modules at test time. ES6 imports are evaluated at module load time,
 * which would cause the actual modules to be loaded even in test contexts.
 * With require(), these modules are only loaded when this function is called,
 * which only happens in production (tests inject mock dependencies directly).
 */
export function createProductionDependencies(): ActionDependencies {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const coreModule = require('@actions/core') as typeof core;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const githubModule = require('@actions/github') as typeof github;

  return {
    core: {
      getInput: coreModule.getInput,
      setOutput: coreModule.setOutput,
      setFailed: coreModule.setFailed,
      warning: coreModule.warning,
      info: coreModule.info,
      summary: coreModule.summary,
    },
    github: {
      context: githubModule.context,
      getOctokit: githubModule.getOctokit,
    },
  };
}
