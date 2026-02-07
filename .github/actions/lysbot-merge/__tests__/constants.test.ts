/**
 * constants.test.ts - Tests for constants module
 *
 * Tests validate the constants, regex patterns, and configuration values
 * used throughout the action, including:
 * - COMMAND_REGEX: Matching /lysbot merge commands
 * - CONVENTIONAL_COMMIT_REGEX: Validating commit message formats
 * - CONVENTIONAL_COMMIT_TYPES: Allowed commit types
 */

import { describe, it, expect } from 'vitest';

import {
  BOT_MENTION_REGEX,
  CONVENTIONAL_COMMIT_TYPES,
  CONVENTIONAL_COMMIT_REGEX,
  COMMAND_REGEX,
} from '../src/constants.js';

// =============================================================================
// Tests for BOT_MENTION_REGEX constant
// =============================================================================

describe('BOT_MENTION_REGEX', () => {
  it('should be a valid regex pattern', () => {
    expect(BOT_MENTION_REGEX).toBeInstanceOf(RegExp);
  });

  it('should match bot mentions with 2-5 chars before "bot" and a space after', () => {
    const validPatterns = [
      '/lysbot merge',
      '/mybot command',
      '/aibot help',
      '/ghbot test',
      '/xyzbot merge',
      '/abcdebot test',
      'Some text /lysbot merge more text',
    ];

    for (const pattern of validPatterns) {
      expect(BOT_MENTION_REGEX.test(pattern)).toBe(true);
    }
  });

  it('should not match patterns with too short prefix (less than 2 chars)', () => {
    const invalidPatterns = ['/bot command', '/xbot test'];

    for (const pattern of invalidPatterns) {
      expect(BOT_MENTION_REGEX.test(pattern)).toBe(false);
    }
  });

  it('should not match patterns with too long prefix (more than 5 chars)', () => {
    const invalidPatterns = ['/toolongbot command', '/verylongbot test', '/abcdefbot merge'];

    for (const pattern of invalidPatterns) {
      expect(BOT_MENTION_REGEX.test(pattern)).toBe(false);
    }
  });

  it('should not match without space after bot', () => {
    const invalidPatterns = ['/lysbotmerge', '/lysbot-merge', '/lysbot'];

    for (const pattern of invalidPatterns) {
      expect(BOT_MENTION_REGEX.test(pattern)).toBe(false);
    }
  });

  it('should not match without slash before bot name', () => {
    const invalidPatterns = ['lysbot merge', 'mybot command'];

    for (const pattern of invalidPatterns) {
      expect(BOT_MENTION_REGEX.test(pattern)).toBe(false);
    }
  });
});

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
    // The actual flag validation is done in parseCommand
    const testCases = [
      { input: '/lysbot merge', expected: true },
      { input: '  /lysbot merge', expected: true },
      { input: '/lysbot merge  ', expected: true },
      { input: '/lysbot  merge', expected: true },
      { input: '/lysbot merge --override-approval-requirement', expected: true },
      { input: '/lysbot merge now', expected: true }, // Regex matches, but parseCommand rejects
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
