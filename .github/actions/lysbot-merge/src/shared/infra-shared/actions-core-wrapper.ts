/**
 * actions-core-wrapper.ts - Wrapper for @actions/core
 *
 * This module provides a thin wrapper around @actions/core to isolate
 * the dependency and make it easier to test code that needs these functions.
 * Only action and infra layers should import this module.
 */

import * as core from '@actions/core';

/**
 * Interface for GitHub Actions core functionality.
 * This allows us to create test doubles without depending on @actions/core.
 */
export interface IActionsCore {
  getInput(name: string, options?: core.InputOptions): string;
  setOutput(name: string, value: unknown): void;
  setFailed(message: string | Error): void;
  info(message: string): void;
  warning(message: string | Error, properties?: core.AnnotationProperties): void;
  error(message: string | Error, properties?: core.AnnotationProperties): void;
  summary: {
    addRaw(text: string): typeof core.summary;
    write(): Promise<typeof core.summary>;
  };
}

/**
 * Production implementation of IActionsCore using @actions/core.
 */
export class ActionsCore implements IActionsCore {
  getInput(name: string, options?: core.InputOptions): string {
    return core.getInput(name, options);
  }

  setOutput(name: string, value: unknown): void {
    core.setOutput(name, value);
  }

  setFailed(message: string | Error): void {
    core.setFailed(message);
  }

  info(message: string): void {
    core.info(message);
  }

  warning(message: string | Error, properties?: core.AnnotationProperties): void {
    core.warning(message, properties);
  }

  error(message: string | Error, properties?: core.AnnotationProperties): void {
    core.error(message, properties);
  }

  get summary() {
    return core.summary;
  }
}
