/**
 * ActionLogger - Implementation of Logger port using @actions/core
 *
 * This adapter implements the Logger port defined in the usecases layer
 * using the @actions/core library.
 */

import * as core from '@actions/core';

import type { Logger } from '../../usecases/ports/Logger.js';

/**
 * GitHub Actions implementation of Logger
 */
export class ActionLogger implements Logger {
  info(message: string): void {
    core.info(message);
  }

  error(message: string): void {
    core.error(message);
  }

  warning(message: string): void {
    core.warning(message);
  }
}
