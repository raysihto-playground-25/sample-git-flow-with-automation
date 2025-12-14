/**
 * options-parser.ts - Parser for YAML options input
 *
 * This module provides a YAML parser for the options parameter using the `yaml` library.
 * The parser validates types and provides clear error messages for invalid inputs.
 */

import YAML from 'yaml';

import type { ActionConfig } from './types.js';

/**
 * Parsed options from the YAML input.
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
 * Known option keys and their expected types.
 */
const OPTION_SCHEMA: Record<string, 'string' | 'number'> = {
  release_branch_prefix: 'string',
  develop_branch: 'string',
  sync_branch_prefix: 'string',
  mergeable_retry_count: 'number',
  mergeable_retry_interval: 'number',
};

/**
 * Validates that a value is a string.
 * @param value - Value to validate
 * @param key - Field name for error messages
 * @throws Error if value is not a string
 */
function validateString(value: unknown, key: string): asserts value is string {
  if (typeof value !== 'string') {
    const actualType = value === null ? 'null' : typeof value;
    const displayValue = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value === 'object' ? 'object' : String(value);
    throw new Error(
      `Invalid type for "${key}": expected string, but got ${actualType} (value: ${displayValue}). String fields must be text values, not numbers, booleans, null, arrays, or objects.`,
    );
  }
}

/**
 * Validates that a value is a non-negative integer.
 * @param value - Value to validate
 * @param key - Field name for error messages
 * @throws Error if value is not a valid non-negative integer
 */
function validateNonNegativeInteger(value: unknown, key: string): asserts value is number {
  // Check if it's a string number like "10"
  if (typeof value === 'string') {
    throw new Error(
      `Invalid type for "${key}": expected number, but got string (value: "${value}"). Numeric fields must be unquoted numbers like 5, not quoted strings like "5".`,
    );
  }
  
  if (typeof value !== 'number') {
    const actualType = value === null ? 'null' : typeof value;
    const displayValue = value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value === 'object' ? 'object' : String(value);
    throw new Error(
      `Invalid type for "${key}": expected number, but got ${actualType} (value: ${displayValue}). Numeric fields must be numbers, not strings, booleans, null, arrays, or objects.`,
    );
  }

  if (!Number.isInteger(value)) {
    throw new Error(
      `Invalid value for "${key}": expected integer, but got ${value}. The value must be a whole number.`,
    );
  }

  if (value < 0) {
    throw new Error(
      `Invalid value for "${key}": expected non-negative integer, but got ${value}. The value must be 0 or greater.`,
    );
  }
}

/**
 * Parses the options YAML string into a ParsedOptions object.
 *
 * @param optionsYaml - YAML string with key: value pairs
 * @returns Parsed options object
 * @throws Error if parsing fails or validation fails
 */
export function parseOptions(optionsYaml: string): ParsedOptions {
  const options: ParsedOptions = {};

  // If empty string, return empty options
  if (!optionsYaml || optionsYaml.trim() === '') {
    return options;
  }

  // Parse YAML
  let parsed: unknown;
  try {
    parsed = YAML.parse(optionsYaml);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to parse YAML options: ${message}`);
  }

  // Validate that parsed result is an object
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(
      `Invalid options format: expected YAML object with key-value pairs, but got ${parsed === null ? 'null' : Array.isArray(parsed) ? 'array' : typeof parsed}`,
    );
  }

  // Validate each option
  for (const [key, value] of Object.entries(parsed)) {
    // Check if it's a known option
    const expectedType = OPTION_SCHEMA[key];
    if (!expectedType) {
      throw new Error(
        `Unknown option: "${key}". Valid options are: ${Object.keys(OPTION_SCHEMA).join(', ')}`,
      );
    }

    // Validate based on expected type
    if (expectedType === 'string') {
      validateString(value, key);
      (options as Record<string, string>)[key] = value as string;
    } else if (expectedType === 'number') {
      validateNonNegativeInteger(value, key);
      (options as Record<string, number>)[key] = value as number;
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
