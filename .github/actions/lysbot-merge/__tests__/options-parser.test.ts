/**
 * options-parser.test.ts - Tests for options-parser.ts module
 *
 * Tests cover:
 * - parseOptions: Parsing YAML-like options string
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

  it('should handle extra whitespace around colons', () => {
    const yaml = `
release_branch_prefix   :   release/
develop_branch:develop
sync_branch_prefix  :  fix/sync/
    `;
    const result = parseOptions(yaml);
    expect(result).toEqual({
      release_branch_prefix: 'release/',
      develop_branch: 'develop',
      sync_branch_prefix: 'fix/sync/',
    });
  });

  it('should throw error for invalid format', () => {
    const yaml = `
release_branch_prefix: release/
invalid line without colon
    `;
    expect(() => parseOptions(yaml)).toThrow('Invalid option format at line 3');
  });

  it('should throw error for unknown option', () => {
    const yaml = `
release_branch_prefix: release/
unknown_option: value
    `;
    expect(() => parseOptions(yaml)).toThrow('Unknown option at line 3: "unknown_option"');
  });

  it('should throw error for invalid retry count (non-numeric)', () => {
    const yaml = `
mergeable_retry_count: abc
    `;
    expect(() => parseOptions(yaml)).toThrow('Invalid value for mergeable_retry_count at line 2');
  });

  it('should throw error for invalid retry count (negative)', () => {
    const yaml = `
mergeable_retry_count: -5
    `;
    expect(() => parseOptions(yaml)).toThrow('Invalid value for mergeable_retry_count at line 2');
  });

  it('should throw error for invalid retry interval (non-numeric)', () => {
    const yaml = `
mergeable_retry_interval: xyz
    `;
    expect(() => parseOptions(yaml)).toThrow('Invalid value for mergeable_retry_interval at line 2');
  });

  it('should throw error for invalid retry interval (negative)', () => {
    const yaml = `
mergeable_retry_interval: -10
    `;
    expect(() => parseOptions(yaml)).toThrow('Invalid value for mergeable_retry_interval at line 2');
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
