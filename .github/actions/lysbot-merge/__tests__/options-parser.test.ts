/**
 * options-parser.test.ts - Tests for options-parser.ts module
 *
 * Tests cover:
 * - parseOptions: Parsing YAML options string
 * - buildConfig: Building ActionConfig with defaults
 */

import { describe, it, expect } from 'vitest';

import { parseOptions, buildConfig } from '../src/options-parser.js';

// =============================================================================
// parseOptions Tests
// =============================================================================

describe('parseOptions', () => {
  it('should return empty object for empty string', () => {
    const result = parseOptions('');
    expect(result).toEqual({});
  });

  it('should return empty object for whitespace-only string', () => {
    const result = parseOptions('   \n  \n  ');
    expect(result).toEqual({});
  });

  it('should parse full options with quotes', () => {
    const yaml = `
release_branch_prefix: "release/"
develop_branch: "develop"
sync_branch_prefix: "fix/sync/"
mergeable_retry_count: 5
mergeable_retry_interval: 10
    `;
    const result = parseOptions(yaml);
    expect(result).toEqual({
      release_branch_prefix: 'release/',
      develop_branch: 'develop',
      sync_branch_prefix: 'fix/sync/',
      mergeable_retry_count: 5,
      mergeable_retry_interval: 10,
    });
  });

  it('should parse full options without quotes', () => {
    const yaml = `
release_branch_prefix: release/
develop_branch: develop
sync_branch_prefix: fix/sync/
mergeable_retry_count: 5
mergeable_retry_interval: 10
    `;
    const result = parseOptions(yaml);
    expect(result).toEqual({
      release_branch_prefix: 'release/',
      develop_branch: 'develop',
      sync_branch_prefix: 'fix/sync/',
      mergeable_retry_count: 5,
      mergeable_retry_interval: 10,
    });
  });

  it('should parse partial options', () => {
    const yaml = `
release_branch_prefix: release/
develop_branch: develop
sync_branch_prefix: fix/sync/
    `;
    const result = parseOptions(yaml);
    expect(result).toEqual({
      release_branch_prefix: 'release/',
      develop_branch: 'develop',
      sync_branch_prefix: 'fix/sync/',
    });
  });

  it('should skip comment lines', () => {
    const yaml = `
## Project-specific branch naming configuration
release_branch_prefix: release/
develop_branch: develop
sync_branch_prefix: fix/sync/
## Optional: customize retry behavior for mergeable status
# mergeable_retry_count: 5
# mergeable_retry_interval: 10
    `;
    const result = parseOptions(yaml);
    expect(result).toEqual({
      release_branch_prefix: 'release/',
      develop_branch: 'develop',
      sync_branch_prefix: 'fix/sync/',
    });
  });

  it('should handle mixed quotes (double and single)', () => {
    const yaml = `
release_branch_prefix: "release/"
develop_branch: 'develop'
sync_branch_prefix: fix/sync/
    `;
    const result = parseOptions(yaml);
    expect(result).toEqual({
      release_branch_prefix: 'release/',
      develop_branch: 'develop',
      sync_branch_prefix: 'fix/sync/',
    });
  });

  it('should handle extra whitespace (valid YAML)', () => {
    const yaml = `
release_branch_prefix: release/
develop_branch: develop
sync_branch_prefix: fix/sync/
    `;
    const result = parseOptions(yaml);
    expect(result).toEqual({
      release_branch_prefix: 'release/',
      develop_branch: 'develop',
      sync_branch_prefix: 'fix/sync/',
    });
  });

  it('should throw error for unknown option', () => {
    const yaml = `
release_branch_prefix: release/
unknown_option: value
    `;
    expect(() => parseOptions(yaml)).toThrow('Unknown option: "unknown_option"');
  });

  it('should handle zero for retry count', () => {
    const yaml = `
mergeable_retry_count: 0
    `;
    const result = parseOptions(yaml);
    expect(result).toEqual({
      mergeable_retry_count: 0,
    });
  });

  it('should handle zero for retry interval', () => {
    const yaml = `
mergeable_retry_interval: 0
    `;
    const result = parseOptions(yaml);
    expect(result).toEqual({
      mergeable_retry_interval: 0,
    });
  });

  it('should handle single-character quoted values', () => {
    const yaml = `
release_branch_prefix: "/"
develop_branch: 'd'
    `;
    const result = parseOptions(yaml);
    expect(result).toEqual({
      release_branch_prefix: '/',
      develop_branch: 'd',
    });
  });

  // Error cases for string fields with invalid types
  it('should throw error for number value in string field (error case 1)', () => {
    const yaml = `release_branch_prefix: 10`;
    expect(() => parseOptions(yaml)).toThrow(
      'Invalid type for "release_branch_prefix": expected string, but got number',
    );
  });

  it('should throw error for boolean false in string field (error case 2)', () => {
    const yaml = `release_branch_prefix: false`;
    expect(() => parseOptions(yaml)).toThrow(
      'Invalid type for "release_branch_prefix": expected string, but got boolean',
    );
  });

  it('should throw error for boolean TRUE in string field (error case 3)', () => {
    const yaml = `release_branch_prefix: TRUE`;
    expect(() => parseOptions(yaml)).toThrow(
      'Invalid type for "release_branch_prefix": expected string, but got boolean',
    );
  });

  it('should throw error for null in string field (error case 4)', () => {
    const yaml = `release_branch_prefix: null`;
    expect(() => parseOptions(yaml)).toThrow(
      'Invalid type for "release_branch_prefix": expected string, but got null',
    );
  });

  it('should throw error for object in string field (error case 5)', () => {
    const yaml = `release_branch_prefix: { key: "release/" }`;
    expect(() => parseOptions(yaml)).toThrow(
      'Invalid type for "release_branch_prefix": expected string, but got object',
    );
  });

  it('should throw error for array in string field (error case 6)', () => {
    const yaml = `release_branch_prefix: [ "release/" ]`;
    expect(() => parseOptions(yaml)).toThrow(
      'Invalid type for "release_branch_prefix": expected string, but got object',
    );
  });

  it('should throw error for nested array in string field (error case 7)', () => {
    const yaml = `
release_branch_prefix:
  - "release/"
    `;
    expect(() => parseOptions(yaml)).toThrow(
      'Invalid type for "release_branch_prefix": expected string, but got object',
    );
  });

  it('should throw error for nested object in string field (error case 8)', () => {
    const yaml = `
release_branch_prefix:
  name: "release/"
    `;
    expect(() => parseOptions(yaml)).toThrow(
      'Invalid type for "release_branch_prefix": expected string, but got object',
    );
  });

  // Error cases for numeric fields with invalid types
  it('should throw error for string number in numeric field (error case 9)', () => {
    const yaml = `mergeable_retry_count: "10"`;
    expect(() => parseOptions(yaml)).toThrow(
      'Invalid type for "mergeable_retry_count": expected number, but got string (value: "10")',
    );
  });

  it('should throw error for boolean False in numeric field (error case 10)', () => {
    const yaml = `mergeable_retry_count: False`;
    expect(() => parseOptions(yaml)).toThrow(
      'Invalid type for "mergeable_retry_count": expected number, but got boolean',
    );
  });

  it('should throw error for null in numeric field (error case 11)', () => {
    const yaml = `mergeable_retry_count: null`;
    expect(() => parseOptions(yaml)).toThrow(
      'Invalid type for "mergeable_retry_count": expected number, but got null',
    );
  });

  it('should throw error for negative number', () => {
    const yaml = `mergeable_retry_count: -5`;
    expect(() => parseOptions(yaml)).toThrow(
      'Invalid value for "mergeable_retry_count": expected non-negative integer, but got -5',
    );
  });

  it('should throw error for float number', () => {
    const yaml = `mergeable_retry_count: 5.5`;
    expect(() => parseOptions(yaml)).toThrow(
      'Invalid value for "mergeable_retry_count": expected integer, but got 5.5',
    );
  });
});

// =============================================================================
// buildConfig Tests
// =============================================================================

describe('buildConfig', () => {
  it('should apply all defaults for empty options', () => {
    const config = buildConfig({});
    expect(config).toEqual({
      releaseBranchPrefix: 'release/',
      developBranch: 'develop',
      syncBranchPrefix: 'fix/sync/',
      mergeableRetryCount: 5,
      mergeableRetryInterval: 10,
    });
  });

  it('should use provided values and apply defaults for missing ones', () => {
    const config = buildConfig({
      release_branch_prefix: 'rel/',
      develop_branch: 'main',
    });
    expect(config).toEqual({
      releaseBranchPrefix: 'rel/',
      developBranch: 'main',
      syncBranchPrefix: 'fix/sync/',
      mergeableRetryCount: 5,
      mergeableRetryInterval: 10,
    });
  });

  it('should use all provided values', () => {
    const config = buildConfig({
      release_branch_prefix: 'rel/',
      develop_branch: 'main',
      sync_branch_prefix: 'sync/',
      mergeable_retry_count: 3,
      mergeable_retry_interval: 5,
    });
    expect(config).toEqual({
      releaseBranchPrefix: 'rel/',
      developBranch: 'main',
      syncBranchPrefix: 'sync/',
      mergeableRetryCount: 3,
      mergeableRetryInterval: 5,
    });
  });

  it('should handle zero values correctly', () => {
    const config = buildConfig({
      mergeable_retry_count: 0,
      mergeable_retry_interval: 0,
    });
    expect(config).toEqual({
      releaseBranchPrefix: 'release/',
      developBranch: 'develop',
      syncBranchPrefix: 'fix/sync/',
      mergeableRetryCount: 0,
      mergeableRetryInterval: 0,
    });
  });
});
