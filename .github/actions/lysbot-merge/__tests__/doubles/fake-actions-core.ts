/**
 * fake-actions-core.ts - Fake implementation of IActionsCore for testing
 *
 * This is a test double (fake) that captures actions core calls for verification.
 */

import type { IActionsCore } from '../../src/shared/infra-shared/index.js';

/**
 * Fake Actions Core for testing.
 * Captures all actions core method calls for verification.
 */
export class FakeActionsCore implements IActionsCore {
  inputs: Map<string, string> = new Map();
  outputs: Map<string, unknown> = new Map();
  failedMessages: string[] = [];
  infoMessages: string[] = [];
  warningMessages: string[] = [];
  errorMessages: string[] = [];
  summaryContent: string = '';

  getInput(name: string, options?: { required?: boolean }): string {
    const value = this.inputs.get(name) ?? '';
    if (options?.required && !value) {
      throw new Error(`Input required and not supplied: ${name}`);
    }
    return value;
  }

  setOutput(name: string, value: unknown): void {
    this.outputs.set(name, value);
  }

  setFailed(message: string | Error): void {
    const msg = typeof message === 'string' ? message : message.message;
    this.failedMessages.push(msg);
  }

  info(message: string): void {
    this.infoMessages.push(message);
  }

  warning(message: string | Error): void {
    const msg = typeof message === 'string' ? message : message.message;
    this.warningMessages.push(msg);
  }

  error(message: string | Error): void {
    const msg = typeof message === 'string' ? message : message.message;
    this.errorMessages.push(msg);
  }

  get summary(): IActionsCore['summary'] {
    return {
      addRaw: (text: string) => {
        this.summaryContent += text;
        return this.summary;
      },
      // eslint-disable-next-line @typescript-eslint/require-await
      write: async () => {
        return this.summary;
      },
    } as IActionsCore['summary'];
  }

  // Helper methods for test setup
  setInput(name: string, value: string): void {
    this.inputs.set(name, value);
  }

  getOutput(name: string): unknown {
    return this.outputs.get(name);
  }

  clear(): void {
    this.inputs.clear();
    this.outputs.clear();
    this.failedMessages = [];
    this.infoMessages = [];
    this.warningMessages = [];
    this.errorMessages = [];
    this.summaryContent = '';
  }
}
