/**
 * fake-time-provider.ts - Fake implementation of ITimeProvider for testing
 *
 * This is a test double (fake) that allows controlling time in tests.
 */

import type { ITimeProvider } from '../../src/modules/merge/app.js';

/**
 * Fake Time Provider for testing.
 * Allows synchronous "waiting" without actual delays.
 */
export class FakeTimeProvider implements ITimeProvider {
  waitCalls: number[] = [];

  // eslint-disable-next-line @typescript-eslint/require-await
  async waitMs(ms: number): Promise<void> {
    this.waitCalls.push(ms);
    // Don't actually wait - this makes tests fast
  }

  // Helper methods for test assertions
  getWaitCallCount(): number {
    return this.waitCalls.length;
  }

  getLastWaitMs(): number | undefined {
    return this.waitCalls[this.waitCalls.length - 1];
  }

  clear(): void {
    this.waitCalls = [];
  }
}
