/**
 * CommandParser.test.ts - Tests for CommandParser domain service
 */

import { describe, it, expect } from 'vitest';

import { CommandParser } from '../../src/domain/services/CommandParser.js';

describe('CommandParser', () => {
  const parser = new CommandParser();

  describe('parse', () => {
    it('should parse valid merge command', () => {
      const result = parser.parse('/lysbot merge');
      expect(result).not.toBeNull();
      expect(result?.overrideApprovalRequirement).toBe(false);
    });

    it('should parse merge command with override flag', () => {
      const result = parser.parse('/lysbot merge --override-approval-requirement');
      expect(result).not.toBeNull();
      expect(result?.overrideApprovalRequirement).toBe(true);
    });

    it('should handle whitespace', () => {
      const result = parser.parse('  /lysbot merge  ');
      expect(result).not.toBeNull();
    });

    it('should return null for invalid command', () => {
      const result = parser.parse('hello');
      expect(result).toBeNull();
    });

    it('should return null for invalid flags', () => {
      const result = parser.parse('/lysbot merge --invalid-flag');
      expect(result).toBeNull();
    });
  });

  describe('isCommand', () => {
    it('should return true for valid command', () => {
      expect(parser.isCommand('/lysbot merge')).toBe(true);
    });

    it('should return false for invalid command', () => {
      expect(parser.isCommand('hello')).toBe(false);
    });
  });
});
