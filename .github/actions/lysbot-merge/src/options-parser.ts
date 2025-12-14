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
 * Zod schema for validating parsed options.
 * Each field has specific type requirements and default values:
 * - String fields for branch prefixes
 * - Non-negative integer fields for retry settings
 * Using strict() to reject unknown properties
 */
const OPTIONS_SCHEMA = z
  .object({
    release_branch_prefix: z.string().default('release/'),
    develop_branch: z.string().default('develop'),
    sync_branch_prefix: z.string().default('fix/sync/'),
    mergeable_retry_count: z.number().int().nonnegative().default(5),
    mergeable_retry_interval: z.number().int().nonnegative().default(10),
  })
  .strict();

/**
 * Parsed options from the YAML input.
 */
export type ParsedOptions = z.infer<typeof OPTIONS_SCHEMA>;

/**
 * Parses the options YAML string into a ParsedOptions object.
 *
 * @param optionsYaml - YAML string with key: value pairs
 * @returns Parsed options object
 * @throws Error if parsing fails or validation fails
 */
export function parseOptions(optionsYaml: string): ParsedOptions {
  // If empty string, parse as empty object to get defaults
  if (!optionsYaml || optionsYaml.trim() === '') {
    const result = OPTIONS_SCHEMA.safeParse({});
    if (!result.success) {
      throw new Error(`Invalid options: ${result.error.message}`);
    }
    return result.data;
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
  const result = OPTIONS_SCHEMA.safeParse(parsed);
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
    releaseBranchPrefix: parsedOptions.release_branch_prefix,
    developBranch: parsedOptions.develop_branch,
    syncBranchPrefix: parsedOptions.sync_branch_prefix,
    mergeableRetryCount: parsedOptions.mergeable_retry_count,
    mergeableRetryInterval: parsedOptions.mergeable_retry_interval,
  };
}
