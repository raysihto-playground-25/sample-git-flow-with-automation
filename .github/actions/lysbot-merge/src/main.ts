import { executeAction } from './action.js';
import {
  createOctokit,
  logError,
  logResult,
  readConfig,
  readContext,
  readToken,
  writeOutputs,
  writeSummary,
} from './modules/lysbot-merge-core/io-adapter.js';

/**
 * main.ts - Composition Root (Pure DI)
 *
 * Responsibilities:
 * - Construct dependencies (Octokit, config objects, context)
 * - Invoke the main action function
 * - Handle exceptions and log results
 *
 * Out-of-scope (delegated to io-adapter):
 * - Reading configuration from GitHub Actions inputs
 * - Setting action outputs
 * - Writing summaries
 * - Logging informational messages
 */
export async function run(): Promise<void> {
  try {
    // Construct dependencies
    const token = readToken();
    const config = readConfig();
    const context = readContext();
    const octokit = createOctokit(token);

    // Execute business logic
    const result = await executeAction(octokit, context, config);

    // Delegate I/O operations
    writeOutputs(result);
    await writeSummary(result, context);
    logResult(result);
  } catch (error) {
    // Handle exceptions
    logError(error);
  }
}
