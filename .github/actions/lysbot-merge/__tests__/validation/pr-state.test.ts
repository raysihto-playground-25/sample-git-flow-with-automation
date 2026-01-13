import { describe, it, expect } from 'vitest';

import type { PullRequestData } from '../../src/types/index.js';
import { validatePRState, getMergeableStateDescription } from '../../src/validation/pr-state.js';

function createPRData(overrides: Partial<PullRequestData> = {}): PullRequestData {
  return {
    state: 'open',
    locked: false,
    draft: false,
    merged: false,
    mergeable: true,
    mergeableState: 'clean',
    headSha: 'abc1234567890',
    headRef: 'feature/test',
    baseRef: 'develop',
    author: 'testuser',
    isFork: false,
    title: 'feat: test pull request',
    ...overrides,
  };
}

describe('validatePRState', () => {
  describe('valid PR state', () => {
    it('passes consolidated check for valid open PR', () => {
      const prData = createPRData();
      const checks = validatePRState(prData);

      expect(checks).toHaveLength(1);
      expect(checks[0]?.name).toBe('PR is ready for review');
      expect(checks[0]?.passed).toBe(true);
      expect(checks[0]?.details).toBeUndefined();
    });
  });

  describe('invalid PR states', () => {
    it('fails check when PR is closed', () => {
      const prData = createPRData({ state: 'closed' });
      const checks = validatePRState(prData);

      expect(checks).toHaveLength(1);
      const check = checks[0];
      expect(check).toBeDefined();
      expect(check?.name).toBe('PR is ready for review');
      expect(check?.passed).toBe(false);
      expect(check?.details).toBe('currently closed');
    });

    it('fails check when PR is locked', () => {
      const prData = createPRData({ locked: true });
      const checks = validatePRState(prData);

      expect(checks).toHaveLength(1);
      const check = checks[0];
      expect(check).toBeDefined();
      expect(check?.name).toBe('PR is ready for review');
      expect(check?.passed).toBe(false);
      expect(check?.details).toBe('currently locked');
    });

    it('fails check when PR is a draft', () => {
      const prData = createPRData({ draft: true });
      const checks = validatePRState(prData);

      expect(checks).toHaveLength(1);
      const check = checks[0];
      expect(check).toBeDefined();
      expect(check?.name).toBe('PR is ready for review');
      expect(check?.passed).toBe(false);
      expect(check?.details).toBe('currently a draft');
    });

    it('fails check with multiple reasons when PR has multiple issues', () => {
      const prData = createPRData({ state: 'closed', locked: true });
      const checks = validatePRState(prData);

      expect(checks).toHaveLength(1);
      const check = checks[0];
      expect(check).toBeDefined();
      expect(check?.name).toBe('PR is ready for review');
      expect(check?.passed).toBe(false);
      expect(check?.details).toBe('currently closed, currently locked');
    });

    it('fails check with all three reasons when all conditions fail', () => {
      const prData = createPRData({ state: 'closed', locked: true, draft: true });
      const checks = validatePRState(prData);

      expect(checks).toHaveLength(1);
      const check = checks[0];
      expect(check).toBeDefined();
      expect(check?.name).toBe('PR is ready for review');
      expect(check?.passed).toBe(false);
      expect(check?.details).toBe('currently closed, currently locked, currently a draft');
    });
  });
});

describe('getMergeableStateDescription', () => {
  it('should return correct description for dirty state', () => {
    expect(getMergeableStateDescription('dirty')).toBe('has unresolved conflicts');
  });

  it('should return correct description for blocked state', () => {
    expect(getMergeableStateDescription('blocked')).toContain('blocked');
  });

  it('should return correct description for unstable state', () => {
    expect(getMergeableStateDescription('unstable')).toContain('failing status checks');
  });

  it('should return correct description for behind state', () => {
    expect(getMergeableStateDescription('behind')).toContain('behind');
  });

  it('should return correct description for unknown state', () => {
    expect(getMergeableStateDescription('unknown')).toContain('not yet computed');
  });

  it('should return correct description for has_hooks state', () => {
    expect(getMergeableStateDescription('has_hooks')).toContain('hooks');
  });

  it('should return correct description for clean state', () => {
    expect(getMergeableStateDescription('clean')).toBe('ready to merge');
  });

  it('should return fallback for unknown states', () => {
    expect(getMergeableStateDescription('foo')).toContain('mergeable_state: foo');
  });
});
