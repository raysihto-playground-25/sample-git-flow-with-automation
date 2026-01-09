/**
 * ConventionalCommitsValidator.test.ts - Tests for ConventionalCommitsValidator
 */

import { describe, it, expect } from 'vitest';

import { ConventionalCommitsValidator } from '../../src/domain/services/ConventionalCommitsValidator.js';

describe('ConventionalCommitsValidator', () => {
  const validator = new ConventionalCommitsValidator();

  describe('isValid', () => {
    it('should validate feat type', () => {
      expect(validator.isValid('feat: add new feature')).toBe(true);
      expect(validator.isValid('feat(scope): add new feature')).toBe(true);
    });

    it('should validate fix type', () => {
      expect(validator.isValid('fix: resolve bug')).toBe(true);
      expect(validator.isValid('fix(auth): resolve login issue')).toBe(true);
    });

    it('should validate all standard types', () => {
      expect(validator.isValid('docs: update readme')).toBe(true);
      expect(validator.isValid('style: format code')).toBe(true);
      expect(validator.isValid('refactor: improve structure')).toBe(true);
      expect(validator.isValid('perf: optimize algorithm')).toBe(true);
      expect(validator.isValid('test: add unit tests')).toBe(true);
      expect(validator.isValid('build: update dependencies')).toBe(true);
      expect(validator.isValid('ci: configure workflow')).toBe(true);
      expect(validator.isValid('chore: update tooling')).toBe(true);
      expect(validator.isValid('revert: revert previous commit')).toBe(true);
    });

    it('should validate custom ux type', () => {
      expect(validator.isValid('ux: improve user experience')).toBe(true);
    });

    it('should handle breaking change marker', () => {
      expect(validator.isValid('feat!: breaking change')).toBe(true);
      expect(validator.isValid('fix(scope)!: breaking fix')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(validator.isValid('Update README')).toBe(false);
      expect(validator.isValid('feat:')).toBe(false);
      expect(validator.isValid('feat: ')).toBe(false);
      expect(validator.isValid('invalid: message')).toBe(false);
    });
  });
});
