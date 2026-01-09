/**
 * modules/merge/index.ts - Public API for merge module
 *
 * Exports only the necessary functions and types for external use.
 */

export {
  executeAction,
  buildSummaryMarkdown,
  OctokitGitHubAdapter,
  NodeTimeAdapter,
  CoreLogAdapter,
} from './mod.js';

export type {
  GitHubPort,
  TimePort,
  LogPort,
} from './mod.js';

// Re-export domain functions for testing
export {
  isConventionalCommitTitle,
  parseCommand,
  isBot,
  hasValidAuthorAssociation,
  hasValidPermission,
  determineMergeMethod,
  validatePRState,
  getMergeableStateDescription,
  buildCheckResultsMarkdown,
} from './mod.js';
