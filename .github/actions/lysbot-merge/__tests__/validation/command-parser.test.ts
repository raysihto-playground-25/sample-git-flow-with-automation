import { describe, it, expect } from 'vitest';

import { isCommand, parseCommand } from '../../src/validation/command-parser.js';

describe('isCommand', () => {
  describe('valid command patterns', () => {
    it('matches exact "/lysbot merge" command', () => {
      expect(isCommand('/lysbot merge')).toBe(true);
    });

    it('matches with leading whitespace (space/tab/newline)', () => {
      expect(isCommand('  /lysbot merge')).toBe(true);
      expect(isCommand('\t/lysbot merge')).toBe(true);
      expect(isCommand('\n/lysbot merge')).toBe(true);
    });

    it('matches with trailing whitespace (space/tab/newline)', () => {
      expect(isCommand('/lysbot merge  ')).toBe(true);
      expect(isCommand('/lysbot merge\t')).toBe(true);
      expect(isCommand('/lysbot merge\n')).toBe(true);
    });

    it('matches with multiple spaces between words', () => {
      expect(isCommand('/lysbot  merge')).toBe(true);
      expect(isCommand('/lysbot   merge')).toBe(true);
      expect(isCommand('/lysbot\tmerge')).toBe(true);
    });

    it('matches with --override-approval-requirement flag', () => {
      expect(isCommand('/lysbot merge --override-approval-requirement')).toBe(true);
      expect(isCommand('  /lysbot merge --override-approval-requirement  ')).toBe(true);
    });
  });

  describe('invalid command patterns', () => {
    it('rejects command with unknown arguments or flags', () => {
      expect(isCommand('/lysbot merge now')).toBe(false);
      expect(isCommand('/lysbot merge --force')).toBe(false);
      expect(isCommand('/lysbot merge --unknown-flag')).toBe(false);
    });

    it('rejects partial or malformed commands', () => {
      expect(isCommand('/lysbot')).toBe(false);
      expect(isCommand('/lysbot merg')).toBe(false);
      expect(isCommand('lysbot merge')).toBe(false);
    });

    it('rejects when command is embedded in other text', () => {
      expect(isCommand('Please /lysbot merge this')).toBe(false);
      expect(isCommand('Run /lysbot merge')).toBe(false);
    });

    it('is case-sensitive (uppercase rejected)', () => {
      expect(isCommand('/LYSBOT MERGE')).toBe(false);
      expect(isCommand('/Lysbot Merge')).toBe(false);
    });
  });
});

describe('parseCommand', () => {
  describe('valid commands', () => {
    it('parses basic command without flags', () => {
      const result = parseCommand('/lysbot merge');
      expect(result).not.toBeNull();
      expect(result?.overrideApprovalRequirement).toBe(false);
    });

    it('parses command with --override-approval-requirement flag', () => {
      const result = parseCommand('/lysbot merge --override-approval-requirement');
      expect(result).not.toBeNull();
      expect(result?.overrideApprovalRequirement).toBe(true);
    });

    it('parses command with flag and extra whitespace', () => {
      const result = parseCommand('  /lysbot merge   --override-approval-requirement  ');
      expect(result).not.toBeNull();
      expect(result?.overrideApprovalRequirement).toBe(true);
    });
  });

  describe('invalid commands', () => {
    it('returns null for non-command text', () => {
      expect(parseCommand('hello world')).toBeNull();
    });

    it('returns null for command with unknown flags', () => {
      expect(parseCommand('/lysbot merge --unknown-flag')).toBeNull();
    });

    it('returns null for malformed commands', () => {
      expect(parseCommand('/lysbot')).toBeNull();
      expect(parseCommand('lysbot merge')).toBeNull();
    });
  });
});
