/**
 * infra-shared/index.ts - Public API for shared infrastructure module
 *
 * This module exports wrappers for @actions/* packages.
 * Only action and infra layers should import from this module.
 */

export * from './actions-core-wrapper.js';
export * from './actions-logger.js';
