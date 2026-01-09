/**
 * MergeMethodPolicy.test.ts - Tests for MergeMethodPolicy domain service
 */

import { describe, it, expect } from 'vitest';

import { MergeMethodPolicy } from '../../src/domain/services/MergeMethodPolicy.js';

describe('MergeMethodPolicy', () => {
  const config = {
    releaseBranchPrefix: 'release/',
    developBranch: 'develop',
    syncBranchPrefix: 'fix/sync/',
  };

  const policy = new MergeMethodPolicy(config);

  describe('determine', () => {
    it('should use merge commit for release branch as head', () => {
      const result = policy.determine('release/v1.0.0', 'main');
      expect(result.method).toBe('merge');
      expect(result.reason).toContain('release branch');
    });

    it('should use merge commit for sync branch as head', () => {
      const result = policy.determine('fix/sync/hotfix', 'main');
      expect(result.method).toBe('merge');
      expect(result.reason).toContain('sync branch');
    });

    it('should use squash for release branch as base', () => {
      const result = policy.determine('feature/test', 'release/v1.0.0');
      expect(result.method).toBe('squash');
      expect(result.reason).toContain('release branch');
    });

    it('should use squash for develop branch as base', () => {
      const result = policy.determine('feature/test', 'develop');
      expect(result.method).toBe('squash');
      expect(result.reason).toContain('develop');
    });

    it('should use merge commit as default', () => {
      const result = policy.determine('feature/test', 'main');
      expect(result.method).toBe('merge');
      expect(result.reason).toContain('Default merge commit');
    });
  });
});
