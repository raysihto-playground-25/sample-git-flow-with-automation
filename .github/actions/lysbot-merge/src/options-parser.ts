/**
 * options-parser.ts - Parser for YAML-like options input
 *
 * This module provides a simple parser for the options parameter which accepts
 * YAML-like key: value pairs. The parser:
 * - Supports comments (lines starting with #)
 * - Supports quoted and unquoted values
 * - Ignores empty lines
 * - Validates that only known options are provided
 */

import type { ActionConfig } from './types.js';

/**
 * Parsed options from the YAML-like input.
 */
export interface ParsedOptions {
  release_branch_prefix?: string;
  develop_branch?: string;
  sync_branch_prefix?: string;
  mergeable_retry_count?: number;
  mergeable_retry_interval?: number;
}

/**
 * Default values for options.
 */
const DEFAULT_OPTIONS: Required<ParsedOptions> = {
  release_branch_prefix: 'release/',
  develop_branch: 'develop',
  sync_branch_prefix: 'fix/sync/',
  mergeable_retry_count: 5,
  mergeable_retry_interval: 10,
};

/**
 * Validates and parses a numeric value.
 * @param value - String value to parse
 * @param fieldName - Name of the field for error messages
 * @param lineNumber - Line number for error messages
 * @returns Parsed number
 * @throws Error if value is not a valid non-negative integer
 */
function parseNonNegativeInteger(value: string, fieldName: string, lineNumber: number): number {
  const num = parseInt(value, 10);
  if (isNaN(num) || num < 0) {
    throw new Error(
      `Invalid value for ${fieldName} at line ${lineNumber}: "${value}". Must be a non-negative integer.`,
    );
  }
  return num;
}

/**
 * Parses the options YAML-like string into a ParsedOptions object.
 *
 * @param optionsYaml - YAML-like string with key: value pairs
 * @returns Parsed options object
 * @throws Error if parsing fails or unknown options are provided
 */
export function parseOptions(optionsYaml: string): ParsedOptions {
  const options: ParsedOptions = {};

  // If empty string, return empty options
  if (!optionsYaml || optionsYaml.trim() === '') {
    return options;
  }

  const lines = optionsYaml.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines and comments
    if (line === '' || line.startsWith('#')) {
      continue;
    }

    // Parse key: value
    const match = line.match(/^([a-z_]+)\s*:\s*(.+)$/);
    if (!match) {
      throw new Error(`Invalid option format at line ${i + 1}: "${line}". Expected format: "key: value"`);
    }

    const key = match[1];
    let value = match[2].trim();

    // Remove quotes if present
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Parse based on key
    switch (key) {
      case 'release_branch_prefix':
        options.release_branch_prefix = value;
        break;
      case 'develop_branch':
        options.develop_branch = value;
        break;
      case 'sync_branch_prefix':
        options.sync_branch_prefix = value;
        break;
      case 'mergeable_retry_count':
        options.mergeable_retry_count = parseNonNegativeInteger(value, 'mergeable_retry_count', i + 1);
        break;
      case 'mergeable_retry_interval':
        options.mergeable_retry_interval = parseNonNegativeInteger(value, 'mergeable_retry_interval', i + 1);
        break;
      default:
        throw new Error(`Unknown option at line ${i + 1}: "${key}"`);
    }
  }

  return options;
}

/**
 * Builds ActionConfig from parsed options, applying defaults for missing values.
 *
 * @param parsedOptions - Parsed options from YAML input
 * @returns Complete ActionConfig with defaults applied
 */
export function buildConfig(parsedOptions: ParsedOptions): ActionConfig {
  return {
    releaseBranchPrefix: parsedOptions.release_branch_prefix ?? DEFAULT_OPTIONS.release_branch_prefix,
    developBranch: parsedOptions.develop_branch ?? DEFAULT_OPTIONS.develop_branch,
    syncBranchPrefix: parsedOptions.sync_branch_prefix ?? DEFAULT_OPTIONS.sync_branch_prefix,
    mergeableRetryCount: parsedOptions.mergeable_retry_count ?? DEFAULT_OPTIONS.mergeable_retry_count,
    mergeableRetryInterval: parsedOptions.mergeable_retry_interval ?? DEFAULT_OPTIONS.mergeable_retry_interval,
  };
}
