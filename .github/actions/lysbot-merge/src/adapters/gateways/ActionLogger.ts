/**
 * ActionLogger.ts - GitHub Actions logger adapter
 *
 * This adapter implements the ILogger port using @actions/core.
 */

import type { ILogger } from '../../usecases/merge/ILogger.js';

/**
 * Core type (imported from @actions/core)
 */
export type Core = {
  info: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
};

/**
 * GitHub Actions logger adapter.
 * Implements ILogger using @actions/core.
 */
export class ActionLogger implements ILogger {
  constructor(private readonly core: Core) {}

  info(message: string): void {
    this.core.info(message);
  }

  error(message: string): void {
    this.core.error(message);
  }

  warning(message: string): void {
    this.core.warning(message);
  }
}
