/**
 * actions-logger.ts - Logger adapter using @actions/core
 *
 * This module provides a logger implementation using @actions/core.
 */

import * as core from '@actions/core';
import type { ILogger } from '../../modules/merge/app.js';

/**
 * Logger implementation using @actions/core.
 */
export class ActionsLogger implements ILogger {
  info(message: string): void {
    core.info(message);
  }

  warning(message: string): void {
    core.warning(message);
  }

  error(message: string): void {
    core.error(message);
  }
}
