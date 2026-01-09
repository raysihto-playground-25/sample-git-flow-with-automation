/**
 * modules/lysbot-merge/index.ts - Public API for lysbot-merge module
 *
 * This file strictly exports only entry functions and types.
 * External components (including main.ts) must only import from here.
 */

// Export only what's needed for external consumption
export type { MergeConfig, EventContext, ActionResult } from './mod.js';

export {
  readActionInputs,
  buildEventContext,
  writeActionOutputs,
  writeActionSummary,
  executeMerge,
  GitHubAdapter,
} from './mod.js';
