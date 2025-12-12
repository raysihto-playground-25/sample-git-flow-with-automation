/**
 * constants.test.ts - Unit tests for constants
 *
 * Tests validate the constants and regex patterns used throughout the action.
 */

import { describe, it, expect } from 'vitest';
import { CONVENTIONAL_COMMIT_TYPES, CONVENTIONAL_COMMIT_REGEX, COMMAND_REGEX } from './constants.js';

// =============================================================================
// Tests for CONVENTIONAL_COMMIT_TYPES constant
// =============================================================================

describe('CONVENTIONAL_COMMIT_TYPES', () => {
  it('should contain exactly 12 types', () => {
    expect(CONVENTIONAL_COMMIT_TYPES).toHaveLength(12);
  });

  it('should include all required types', () => {
    const expectedTypes = [
      'build',
      'chore',
      'ci',
      'docs',
      'feat',
      'fix',
      'perf',
      'refactor',
      'revert',
      'style',
      'test',
      'ux',
    ];
    for (const type of expectedTypes) {
      expect(CONVENTIONAL_COMMIT_TYPES).toContain(type);
    }
  });
});

// =============================================================================
// Tests for CONVENTIONAL_COMMIT_REGEX constant
// =============================================================================

describe('CONVENTIONAL_COMMIT_REGEX', () => {
  it('should be a valid regex pattern', () => {
    expect(CONVENTIONAL_COMMIT_REGEX).toBeInstanceOf(RegExp);
  });

  it('should match valid conventional commit titles', () => {
    const validTitles = [
      'feat: add feature',
      'fix(auth): resolve bug',
      'docs: update readme',
      'feat!: breaking change',
      'fix(api)!: breaking fix',
    ];

    for (const title of validTitles) {
      expect(CONVENTIONAL_COMMIT_REGEX.test(title)).toBe(true);
    }
  });

  it('should not match invalid titles', () => {
    const invalidTitles = ['Update README', 'feature: not supported', ': no type', 'feat:'];

    for (const title of invalidTitles) {
      expect(CONVENTIONAL_COMMIT_REGEX.test(title)).toBe(false);
    }
  });
});

// =============================================================================
// Tests for COMMAND_REGEX constant
// =============================================================================

describe('COMMAND_REGEX', () => {
  it('should be a valid regex pattern', () => {
    expect(COMMAND_REGEX).toBeInstanceOf(RegExp);
  });

  it('should match basic command patterns and capture optional flags', () => {
    // Note: COMMAND_REGEX now captures optional flags after "merge"
    // The actual flag validation is done in isCommand
    const testCases = [
      { input: '/lysbot merge', expected: true },
      { input: '  /lysbot merge', expected: true },
      { input: '/lysbot merge  ', expected: true },
      { input: '/lysbot  merge', expected: true },
      { input: '/lysbot merge --override-approval-requirement', expected: true },
      { input: '/lysbot merge now', expected: true }, // Regex matches, but isCommand rejects
      { input: 'run /lysbot merge', expected: false }, // Text before command
    ];

    for (const { input, expected } of testCases) {
      expect(COMMAND_REGEX.test(input)).toBe(expected);
    }
  });

  it('should capture flags from command', () => {
    const match = COMMAND_REGEX.exec('/lysbot merge --override-approval-requirement');
    expect(match).not.toBeNull();
    expect(match?.[1]?.trim()).toBe('--override-approval-requirement');
  });
});
