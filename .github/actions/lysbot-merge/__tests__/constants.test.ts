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
  CONVENTIONAL_COMMIT_TYPES,
  CONVENTIONAL_COMMIT_REGEX,
  BOT_TRIGGER_REGEX,
  COMMAND_REGEX,
} from '../src/constants.js';

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
// Tests for BOT_TRIGGER_REGEX constant
// =============================================================================

describe('BOT_TRIGGER_REGEX', () => {
  it('should be a valid regex pattern', () => {
    expect(BOT_TRIGGER_REGEX).toBeInstanceOf(RegExp);
  });

  it('should match bot-style commands (slash + 2–5 chars + "bot") at line start', () => {
    const matching = ['/lysbot', '  /lysbot', '/xybot', '/longbot', '/xxbot', '/lysbot merge'];
    for (const input of matching) {
      expect(BOT_TRIGGER_REGEX.test(input)).toBe(true);
    }
  });

  it('should not match too short prefix (less than 2 chars before "bot")', () => {
    expect(BOT_TRIGGER_REGEX.test('/bot')).toBe(false);
    expect(BOT_TRIGGER_REGEX.test('/xbot')).toBe(false);
  });

  it('should not match too long prefix (more than 5 chars before "bot")', () => {
    expect(BOT_TRIGGER_REGEX.test('/longnamebot')).toBe(false);
    expect(BOT_TRIGGER_REGEX.test('/toolongbot')).toBe(false);
    expect(BOT_TRIGGER_REGEX.test('/abcdefbot')).toBe(false);
  });

  it('should not match text without bot trigger', () => {
    expect(BOT_TRIGGER_REGEX.test('Hello world')).toBe(false);
    expect(BOT_TRIGGER_REGEX.test('some random text')).toBe(false);
  });

  it('should not match when trigger is not at line start (text before slash)', () => {
    expect(BOT_TRIGGER_REGEX.test('run /lysbot merge')).toBe(false);
    expect(BOT_TRIGGER_REGEX.test('prefix /lysbot')).toBe(false);
  });

  it('should not match without slash before bot name', () => {
    expect(BOT_TRIGGER_REGEX.test('lysbot merge')).toBe(false);
    expect(BOT_TRIGGER_REGEX.test('mybot command')).toBe(false);
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
