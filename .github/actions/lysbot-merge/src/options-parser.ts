/**
 * options-parser.ts - Parser for YAML options input
 *
 * This module provides a YAML parser for the options parameter using the `yaml` library
 * with zod schema validation for type checking and error messages.
 */

import YAML from 'yaml';
import { z } from 'zod';

import type { ActionConfig } from './types.js';

/**
 * Default values for options.
 */
const DEFAULT_OPTIONS = {
  release_branch_prefix: 'release/',
  develop_branch: 'develop',
  sync_branch_prefix: 'fix/sync/',
  mergeable_retry_count: 5,
  mergeable_retry_interval: 10,
} as const;

/**
 * Zod schema for validating parsed options.
 * Each field has specific type requirements:
 * - String fields for branch prefixes
 * - Non-negative integer fields for retry settings
 * Using strict() to reject unknown properties
 */
const optionsSchema = z
  .object({
    release_branch_prefix: z.string().optional(),
    develop_branch: z.string().optional(),
    sync_branch_prefix: z.string().optional(),
    mergeable_retry_count: z.number().int().nonnegative().optional(),
    mergeable_retry_interval: z.number().int().nonnegative().optional(),
  })
  .strict();

/**
 * Parsed options from the YAML input.
 */
export type ParsedOptions = z.infer<typeof optionsSchema>;

/**
 * Parses the options YAML string into a ParsedOptions object.
 *
 * @param optionsYaml - YAML string with key: value pairs
 * @returns Parsed options object
 * @throws Error if parsing fails or validation fails
 */
export function parseOptions(optionsYaml: string): ParsedOptions {
  // If empty string, return empty options
  if (!optionsYaml || optionsYaml.trim() === '') {
    return {};
  }

  // Parse YAML
  let parsed: unknown;
  try {
    parsed = YAML.parse(optionsYaml);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to parse YAML options: ${message}`);
  }

  // Validate using zod schema
  const result = optionsSchema.safeParse(parsed);
  if (!result.success) {
    // Use zod's default error formatting
    throw new Error(`Invalid options: ${result.error.message}`);
  }

  return result.data;
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
