/**
 * options-parser.test.ts - Tests for options-parser.ts module
 *
 * Tests cover:
 * - parseOptions: Parsing YAML options string with kebab-case keys
 */

import { describe, it, expect } from 'vitest';

import { parseOptions } from '../src/options-parser.js';

// =============================================================================
// parseOptions Tests
// =============================================================================

describe('parseOptions', () => {
  it('should return defaults for empty string', () => {
    const result = parseOptions('');
    expect(result).toEqual({
      releaseBranchPrefix: 'release/',
      developBranch: 'develop',
      syncBranchPrefix: 'fix/sync/',
      mergeableRetryCount: 5,
      mergeableRetryInterval: 10,
    });
  });

  it('should return defaults for whitespace-only string', () => {
    const result = parseOptions('   \n  \n  ');
    expect(result).toEqual({
      releaseBranchPrefix: 'release/',
      developBranch: 'develop',
      syncBranchPrefix: 'fix/sync/',
      mergeableRetryCount: 5,
      mergeableRetryInterval: 10,
    });
  });

  it('should parse full options with quotes (kebab-case)', () => {
    const yaml = `
release-branch-prefix: "release/"
develop-branch: "develop"
sync-branch-prefix: "fix/sync/"
mergeable-retry-count: 5
mergeable-retry-interval: 10
    `;
    const result = parseOptions(yaml);
    expect(result).toEqual({
      releaseBranchPrefix: 'release/',
      developBranch: 'develop',
      syncBranchPrefix: 'fix/sync/',
      mergeableRetryCount: 5,
      mergeableRetryInterval: 10,
    });
  });

  it('should parse full options without quotes (kebab-case)', () => {
    const yaml = `
release-branch-prefix: release/
develop-branch: develop
sync-branch-prefix: fix/sync/
mergeable-retry-count: 5
mergeable-retry-interval: 10
    `;
    const result = parseOptions(yaml);
    expect(result).toEqual({
      releaseBranchPrefix: 'release/',
      developBranch: 'develop',
      syncBranchPrefix: 'fix/sync/',
      mergeableRetryCount: 5,
      mergeableRetryInterval: 10,
    });
  });

  it('should parse partial options (kebab-case)', () => {
    const yaml = `
release-branch-prefix: release/
develop-branch: develop
sync-branch-prefix: fix/sync/
    `;
    const result = parseOptions(yaml);
    expect(result).toEqual({
      releaseBranchPrefix: 'release/',
      developBranch: 'develop',
      syncBranchPrefix: 'fix/sync/',
      mergeableRetryCount: 5, // Default value
      mergeableRetryInterval: 10, // Default value
    });
  });

  it('should skip comment lines (kebab-case)', () => {
    const yaml = `
## Project-specific branch naming configuration
release-branch-prefix: release/
develop-branch: develop
sync-branch-prefix: fix/sync/
## Optional: customize retry behavior for mergeable status
# mergeable-retry-count: 5
# mergeable-retry-interval: 10
    `;
    const result = parseOptions(yaml);
    expect(result).toEqual({
      releaseBranchPrefix: 'release/',
      developBranch: 'develop',
      syncBranchPrefix: 'fix/sync/',
      mergeableRetryCount: 5, // Default value
      mergeableRetryInterval: 10, // Default value
    });
  });

  it('should handle mixed quotes (double and single) (kebab-case)', () => {
    const yaml = `
release-branch-prefix: "release/"
develop-branch: 'develop'
sync-branch-prefix: fix/sync/
    `;
    const result = parseOptions(yaml);
    expect(result).toEqual({
      releaseBranchPrefix: 'release/',
      developBranch: 'develop',
      syncBranchPrefix: 'fix/sync/',
      mergeableRetryCount: 5, // Default value
      mergeableRetryInterval: 10, // Default value
    });
  });

  it('should handle extra whitespace (valid YAML) (kebab-case)', () => {
    const yaml = `
release-branch-prefix: release/
develop-branch: develop
sync-branch-prefix: fix/sync/
    `;
    const result = parseOptions(yaml);
    expect(result).toEqual({
      releaseBranchPrefix: 'release/',
      developBranch: 'develop',
      syncBranchPrefix: 'fix/sync/',
      mergeableRetryCount: 5, // Default value
      mergeableRetryInterval: 10, // Default value
    });
  });

  it('should throw error for unknown option', () => {
    const yaml = `
release-branch-prefix: release/
unknown-option: value
    `;
    expect(() => parseOptions(yaml)).toThrow('Invalid options');
  });

  it('should handle zero for retry count (kebab-case)', () => {
    const yaml = `
mergeable-retry-count: 0
    `;
    const result = parseOptions(yaml);
    expect(result).toEqual({
      releaseBranchPrefix: 'release/', // Default value
      developBranch: 'develop', // Default value
      syncBranchPrefix: 'fix/sync/', // Default value
      mergeableRetryCount: 0,
      mergeableRetryInterval: 10, // Default value
    });
  });

  it('should handle zero for retry interval (kebab-case)', () => {
    const yaml = `
mergeable-retry-interval: 0
    `;
    const result = parseOptions(yaml);
    expect(result).toEqual({
      releaseBranchPrefix: 'release/', // Default value
      developBranch: 'develop', // Default value
      syncBranchPrefix: 'fix/sync/', // Default value
      mergeableRetryCount: 5, // Default value
      mergeableRetryInterval: 0,
    });
  });

  it('should handle single-character quoted values (kebab-case)', () => {
    const yaml = `
release-branch-prefix: "/"
develop-branch: 'd'
    `;
    const result = parseOptions(yaml);
    expect(result).toEqual({
      releaseBranchPrefix: '/',
      developBranch: 'd',
      syncBranchPrefix: 'fix/sync/', // Default value
      mergeableRetryCount: 5, // Default value
      mergeableRetryInterval: 10, // Default value
    });
  });

  // Error cases for string fields with invalid types
  it('should throw error for number value in string field (error case 1)', () => {
    const yaml = `release-branch-prefix: 10`;
    expect(() => parseOptions(yaml)).toThrow();
  });

  it('should throw error for boolean false in string field (error case 2)', () => {
    const yaml = `release-branch-prefix: false`;
    expect(() => parseOptions(yaml)).toThrow();
  });

  it('should throw error for boolean TRUE in string field (error case 3)', () => {
    const yaml = `release-branch-prefix: TRUE`;
    expect(() => parseOptions(yaml)).toThrow();
  });

  it('should throw error for null in string field (error case 4)', () => {
    const yaml = `release-branch-prefix: null`;
    expect(() => parseOptions(yaml)).toThrow();
  });

  it('should throw error for object in string field (error case 5)', () => {
    const yaml = `release-branch-prefix: { key: "release/" }`;
    expect(() => parseOptions(yaml)).toThrow();
  });

  it('should throw error for array in string field (error case 6)', () => {
    const yaml = `release-branch-prefix: [ "release/" ]`;
    expect(() => parseOptions(yaml)).toThrow();
  });

  it('should throw error for nested array in string field (error case 7)', () => {
    const yaml = `
release-branch-prefix:
  - "release/"
    `;
    expect(() => parseOptions(yaml)).toThrow();
  });

  it('should throw error for nested object in string field (error case 8)', () => {
    const yaml = `
release-branch-prefix:
  name: "release/"
    `;
    expect(() => parseOptions(yaml)).toThrow();
  });

  // Error cases for numeric fields with invalid types
  it('should throw error for string number in numeric field (error case 9)', () => {
    const yaml = `mergeable-retry-count: "10"`;
    expect(() => parseOptions(yaml)).toThrow();
  });

  it('should throw error for boolean False in numeric field (error case 10)', () => {
    const yaml = `mergeable-retry-count: False`;
    expect(() => parseOptions(yaml)).toThrow();
  });

  it('should throw error for null in numeric field (error case 11)', () => {
    const yaml = `mergeable-retry-count: null`;
    expect(() => parseOptions(yaml)).toThrow();
  });

  it('should throw error for negative number', () => {
    const yaml = `mergeable-retry-count: -5`;
    expect(() => parseOptions(yaml)).toThrow();
  });

  it('should throw error for float number', () => {
    const yaml = `mergeable-retry-count: 5.5`;
    expect(() => parseOptions(yaml)).toThrow();
  });

  // Tests for deprecated inputs
  it('should use deprecated inputs as defaults when no options YAML provided', () => {
    const result = parseOptions('', {
      releaseBranchPrefix: 'custom-release/',
      developBranch: 'main',
      syncBranchPrefix: 'custom-sync/',
      mergeableRetryCount: 3,
      mergeableRetryInterval: 7,
    });
    expect(result).toEqual({
      releaseBranchPrefix: 'custom-release/',
      developBranch: 'main',
      syncBranchPrefix: 'custom-sync/',
      mergeableRetryCount: 3,
      mergeableRetryInterval: 7,
    });
  });

  it('should override deprecated inputs with YAML options', () => {
    const yaml = `
release-branch-prefix: yaml-release/
develop-branch: yaml-dev
    `;
    const result = parseOptions(yaml, {
      releaseBranchPrefix: 'deprecated-release/',
      developBranch: 'deprecated-dev',
      syncBranchPrefix: 'deprecated-sync/',
      mergeableRetryCount: 99,
      mergeableRetryInterval: 99,
    });
    expect(result).toEqual({
      releaseBranchPrefix: 'yaml-release/', // From YAML (overrides deprecated)
      developBranch: 'yaml-dev', // From YAML (overrides deprecated)
      syncBranchPrefix: 'deprecated-sync/', // From deprecated (not in YAML)
      mergeableRetryCount: 99, // From deprecated (not in YAML)
      mergeableRetryInterval: 99, // From deprecated (not in YAML)
    });
  });
});
