/**
 * sanitizer.test.ts - Tests for sanitizer.ts module
 *
 * Tests cover sanitization functions that prevent newline injection attacks
 * in Git commit messages.
 */

import { describe, it, expect } from 'vitest';

import { sanitizeNewlines } from '../src/sanitizer.js';

// =============================================================================
// sanitizeNewlines() Tests
// =============================================================================

describe('sanitizeNewlines', () => {
  describe('Basic newline removal', () => {
    it('should remove LF newlines', () => {
      expect(sanitizeNewlines('Hello\nWorld')).toBe('Hello World');
    });

    it('should remove CR newlines', () => {
      expect(sanitizeNewlines('Hello\rWorld')).toBe('Hello World');
    });

    it('should remove CRLF newlines', () => {
      expect(sanitizeNewlines('Hello\r\nWorld')).toBe('Hello World');
    });

    it('should remove multiple consecutive newlines', () => {
      expect(sanitizeNewlines('Hello\n\n\nWorld')).toBe('Hello World');
    });

    it('should remove mixed newline types', () => {
      expect(sanitizeNewlines('Hello\n\r\n\rWorld')).toBe('Hello World');
    });
  });

  describe('Git trailer injection prevention', () => {
    it('should prevent Signed-off-by injection in PR title', () => {
      const maliciousTitle = 'Fix bug\nSigned-off-by: Attacker <attacker@evil.com>';
      const sanitized = sanitizeNewlines(maliciousTitle);
      expect(sanitized).toBe('Fix bug Signed-off-by: Attacker <attacker@evil.com>');
      expect(sanitized).not.toContain('\n');
    });

    it('should prevent Co-authored-by injection in PR title', () => {
      const maliciousTitle = 'Feature\nCo-authored-by: Fake <fake@fake.com>';
      const sanitized = sanitizeNewlines(maliciousTitle);
      expect(sanitized).toBe('Feature Co-authored-by: Fake <fake@fake.com>');
      expect(sanitized).not.toContain('\n');
    });

    it('should prevent multiple trailer injection in PR title', () => {
      const maliciousTitle =
        'Urgent fix\n\nSigned-off-by: Evil <evil@bad.com>\nCo-authored-by: Faker <faker@fake.com>';
      const sanitized = sanitizeNewlines(maliciousTitle);
      expect(sanitized).not.toContain('\n');
      expect(sanitized.split('\n')).toHaveLength(1);
    });
  });

  describe('Author metadata injection prevention', () => {
    it('should prevent newline injection in author name', () => {
      const maliciousName = 'John Doe\nSigned-off-by: Attacker <attacker@evil.com>';
      const sanitized = sanitizeNewlines(maliciousName);
      expect(sanitized).not.toContain('\n');
      expect(sanitized).toBe('John Doe Signed-off-by: Attacker <attacker@evil.com>');
    });

    it('should prevent newline injection in author email', () => {
      const maliciousEmail = 'user@example.com\nCo-authored-by: Fake <fake@fake.com>';
      const sanitized = sanitizeNewlines(maliciousEmail);
      expect(sanitized).not.toContain('\n');
    });

    it('should prevent trailer injection via author fields', () => {
      const maliciousAuthor = 'Hacker\n>\nCo-authored-by: Another <another@bad.com>';
      const sanitized = sanitizeNewlines(maliciousAuthor);
      expect(sanitized).not.toContain('\n');
      // Verify it becomes a single line
      expect(sanitized.split('\n')).toHaveLength(1);
    });
  });

  describe('Edge cases', () => {
    it('should return empty string for empty input', () => {
      expect(sanitizeNewlines('')).toBe('');
    });

    it('should handle strings with only newlines', () => {
      expect(sanitizeNewlines('\n\n\n')).toBe('');
    });

    it('should handle strings without newlines', () => {
      expect(sanitizeNewlines('Normal text without newlines')).toBe(
        'Normal text without newlines',
      );
    });

    it('should preserve other whitespace characters', () => {
      expect(sanitizeNewlines('Hello\tWorld  Test')).toBe('Hello\tWorld  Test');
    });

    it('should trim leading and trailing whitespace after newline removal', () => {
      expect(sanitizeNewlines('\nHello World\n')).toBe('Hello World');
    });

    it('should handle unicode characters correctly', () => {
      expect(sanitizeNewlines('Hello\n世界\n🌍')).toBe('Hello 世界 🌍');
    });
  });

  describe('Real-world scenarios', () => {
    it('should sanitize typical PR title', () => {
      const prTitle = 'Fix authentication bug in login flow';
      expect(sanitizeNewlines(prTitle)).toBe(prTitle);
    });

    it('should sanitize PR title with line break attempt', () => {
      const prTitle = 'Fix bug (#123)\nBREAKING CHANGE: API updated';
      const sanitized = sanitizeNewlines(prTitle);
      expect(sanitized).toBe('Fix bug (#123) BREAKING CHANGE: API updated');
      expect(sanitized).not.toContain('\n');
    });

    it('should sanitize normal author name', () => {
      const authorName = 'John Doe';
      expect(sanitizeNewlines(authorName)).toBe(authorName);
    });

    it('should sanitize normal author email', () => {
      const authorEmail = 'john.doe@example.com';
      expect(sanitizeNewlines(authorEmail)).toBe(authorEmail);
    });

    it('should handle author names with special characters', () => {
      const authorName = "O'Brien-Smith";
      expect(sanitizeNewlines(authorName)).toBe(authorName);
    });
  });
});
