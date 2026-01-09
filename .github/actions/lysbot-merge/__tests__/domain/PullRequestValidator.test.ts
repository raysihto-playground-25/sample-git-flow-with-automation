/**
 * PullRequestValidator.test.ts - Tests for PullRequestValidator domain service
 */

import { describe, it, expect } from 'vitest';

import type { PullRequest } from '../../src/domain/entities/PullRequest.js';
import { PullRequestValidator } from '../../src/domain/services/PullRequestValidator.js';

describe('PullRequestValidator', () => {
  const validator = new PullRequestValidator();

  function createPR(overrides: Partial<PullRequest> = {}): PullRequest {
    return {
      state: 'open',
      locked: false,
      draft: false,
      merged: false,
      mergeable: true,
      mergeableState: 'clean',
      headSha: 'abc123',
      headRef: 'feature/test',
      baseRef: 'main',
      author: 'testuser',
      isFork: false,
      title: 'Test PR',
      ...overrides,
    };
  }

  describe('validateState', () => {
    it('should pass for ready PR', () => {
      const pr = createPR();
      const checks = validator.validateState(pr);
      expect(checks).toHaveLength(1);
      expect(checks[0]?.passed).toBe(true);
    });

    it('should fail for closed PR', () => {
      const pr = createPR({ state: 'closed' });
      const checks = validator.validateState(pr);
      expect(checks[0]?.passed).toBe(false);
      expect(checks[0]?.details).toContain('closed');
    });

    it('should fail for locked PR', () => {
      const pr = createPR({ locked: true });
      const checks = validator.validateState(pr);
      expect(checks[0]?.passed).toBe(false);
      expect(checks[0]?.details).toContain('locked');
    });

    it('should fail for draft PR', () => {
      const pr = createPR({ draft: true });
      const checks = validator.validateState(pr);
      expect(checks[0]?.passed).toBe(false);
      expect(checks[0]?.details).toContain('draft');
    });

    it('should show multiple failure reasons', () => {
      const pr = createPR({ state: 'closed', locked: true, draft: true });
      const checks = validator.validateState(pr);
      expect(checks[0]?.passed).toBe(false);
      expect(checks[0]?.details).toContain('closed');
      expect(checks[0]?.details).toContain('locked');
      expect(checks[0]?.details).toContain('draft');
    });
  });

  describe('getMergeableStateDescription', () => {
    it('should return description for known states', () => {
      expect(validator.getMergeableStateDescription('clean')).toContain('ready to merge');
      expect(validator.getMergeableStateDescription('dirty')).toContain('unresolved conflicts');
      expect(validator.getMergeableStateDescription('blocked')).toContain('blocked');
      expect(validator.getMergeableStateDescription('unstable')).toContain('failing');
    });

    it('should return default description for unknown state', () => {
      const result = validator.getMergeableStateDescription('unknown_state');
      expect(result).toContain('unknown_state');
    });
  });
});
