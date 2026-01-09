/**
 * index.ts - Public API for the merge module
 *
 * This module exports the public interface that other modules can use.
 * Other modules must ONLY import from this file, not from internal files.
 */

// Export action entry point
export { runMergeAction, buildSummaryMarkdown } from './action.js';

// Export app layer interfaces (for dependency injection)
export type {
  IGitHubRepository,
  ILogger,
  ITimeProvider,
  MergeAppDependencies,
  EventContext,
  MergeResult,
} from './app.js';

// Export infra implementations
export { GitHubRepositoryAdapter, ConsoleLogger, TimeProvider } from './infra.js';
export type { Octokit } from './infra.js';

// Export domain types that are needed externally
export type { ActionConfig } from './domain.js';
