/**
 * options-parser.ts - Parser for YAML options input
 *
 * This module provides a YAML parser for the options parameter using the `yaml` library
 * with zod schema validation for type checking and error messages.
 * Uses camelcase-keys to normalize kebab-case keys to camelCase for internal use.
 */

import camelcaseKeys from 'camelcase-keys';
import YAML from 'yaml';
import { z } from 'zod';

import type { ActionConfig } from './types.js';

/**
 * Zod schema for validating parsed options with camelCase keys.
 * Each field has specific type requirements and default values:
 * - String fields for branch prefixes
 * - Non-negative integer fields for retry settings
 * Using strict() to reject unknown properties
 *
 * Note: Input uses kebab-case (release-branch-prefix) but is converted
 * to camelCase (releaseBranchPrefix) before validation.
 */
const OPTIONS_SCHEMA = z
  .object({
    releaseBranchPrefix: z.string().default('release/'),
    developBranch: z.string().default('develop'),
    syncBranchPrefix: z.string().default('fix/sync/'),
    mergeableRetryCount: z.number().int().nonnegative().default(5),
    mergeableRetryInterval: z.number().int().nonnegative().default(10),
  })
  .strict();

/**
 * Parsed options type matches ActionConfig directly now.
 */
export type ParsedOptions = z.infer<typeof OPTIONS_SCHEMA>;

/**
 * Parses the options YAML string into a ParsedOptions object.
 * Accepts kebab-case keys in YAML and converts them to camelCase.
 *
 * @param optionsYaml - YAML string with key: value pairs (kebab-case keys)
 * @param deprecatedInputs - Optional deprecated individual inputs to merge as defaults
 * @returns Parsed options object with camelCase keys
 * @throws Error if parsing fails or validation fails
 */
export function parseOptions(optionsYaml: string, deprecatedInputs?: Partial<ParsedOptions>): ActionConfig {
  // If empty string, use deprecated inputs or defaults
  if (!optionsYaml || optionsYaml.trim() === '') {
    const inputToValidate = deprecatedInputs || {};
    const result = OPTIONS_SCHEMA.safeParse(inputToValidate);
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

  // Convert kebab-case keys to camelCase
  const camelCased = camelcaseKeys(parsed as Record<string, unknown>, { deep: true });

  // Merge with deprecated inputs (deprecated inputs serve as defaults if not in YAML)
  const mergedOptions = { ...deprecatedInputs, ...camelCased };

  // Validate using zod schema
  const result = OPTIONS_SCHEMA.safeParse(mergedOptions);
  if (!result.success) {
    // Use zod's default error formatting
    throw new Error(`Invalid options: ${result.error.message}`);
  }

  return result.data;
}
