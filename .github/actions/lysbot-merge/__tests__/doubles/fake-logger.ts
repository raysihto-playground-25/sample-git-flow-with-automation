/**
 * fake-logger.ts - Fake implementation of ILogger for testing
 *
 * This is a test double (fake) that captures log messages for verification.
 */

import type { ILogger } from '../../src/modules/merge/app.js';

/**
 * Fake Logger for testing.
 * Captures all log messages for verification.
 */
export class FakeLogger implements ILogger {
  infoMessages: string[] = [];
  warningMessages: string[] = [];
  errorMessages: string[] = [];

  info(message: string): void {
    this.infoMessages.push(message);
  }

  warning(message: string): void {
    this.warningMessages.push(message);
  }

  error(message: string): void {
    this.errorMessages.push(message);
  }

  // Helper methods for test assertions
  hasInfo(message: string): boolean {
    return this.infoMessages.includes(message);
  }

  hasWarning(message: string): boolean {
    return this.warningMessages.includes(message);
  }

  hasError(message: string): boolean {
    return this.errorMessages.includes(message);
  }

  clear(): void {
    this.infoMessages = [];
    this.warningMessages = [];
    this.errorMessages = [];
  }
}
