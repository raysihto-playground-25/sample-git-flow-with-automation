import { describe, it, expect } from 'vitest';

import { determineMergeMethod } from '../../src/merge-logic/merge-method.js';
import type { ActionConfig } from '../../src/types/index.js';

function createConfig(overrides: Partial<ActionConfig> = {}): ActionConfig {
  return {
    releaseBranchPrefix: 'release/',
    developBranch: 'develop',
    syncBranchPrefix: 'fix/sync/',
    mergeableRetryCount: 5,
    mergeableRetryInterval: 10,
    ...overrides,
  };
}

describe('determineMergeMethod', () => {
  const config = createConfig();

  describe('head branch patterns (highest precedence)', () => {
    it('uses merge for PRs from release/* branch (preserves release history)', () => {
      const result = determineMergeMethod('release/1.0.0', 'master', config);
      expect(result.method).toBe('merge');
      expect(result.reason).toContain('release branch');
      expect(result.reason).toContain('preserve release history');
    });

    it('uses merge for PRs from fix/sync/* branch (preserves back-merge history)', () => {
      const result = determineMergeMethod('fix/sync/merge-1.0.0', 'develop', config);
      expect(result.method).toBe('merge');
      expect(result.reason).toContain('sync branch');
      expect(result.reason).toContain('preserve back-merge history');
    });
  });

  describe('base branch patterns', () => {
    it('uses squash for PRs targeting release/* branch (clean release commits)', () => {
      const result = determineMergeMethod('fix/bug-123', 'release/1.0.0', config);
      expect(result.method).toBe('squash');
      expect(result.reason).toContain('release branch');
    });

    it('uses squash for PRs targeting develop branch (clean feature commits)', () => {
      const result = determineMergeMethod('feature/new-feature', 'develop', config);
      expect(result.method).toBe('squash');
      expect(result.reason).toContain('develop');
    });
  });

  describe('default case', () => {
    it('uses merge commit by default for unmatched branch patterns', () => {
      const result = determineMergeMethod('feature/test', 'main', config);
      expect(result.method).toBe('merge');
      expect(result.reason).toContain('Default merge commit');
    });
  });

  describe('precedence rule', () => {
    it('head branch pattern takes precedence over base (release/* to develop uses merge)', () => {
      const result = determineMergeMethod('release/1.0.0', 'develop', config);
      expect(result.method).toBe('merge');
    });
  });
});
