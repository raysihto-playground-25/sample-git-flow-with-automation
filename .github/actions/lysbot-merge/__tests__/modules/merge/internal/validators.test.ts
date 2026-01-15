import { describe, expect, it } from 'vitest';

import {
  determineMergeMethod,
  getMergeableStateDescription,
  hasValidAuthorAssociation,
  hasValidPermission,
  isBot,
  isConventionalCommitTitle,
  parseCommand,
  validatePRState,
} from '../../../../src/modules/merge/internal/validators.js';
import { createMockConfig, createMockPullRequestData } from '../../../helpers/fixtures.js';

describe('validators', () => {
  describe('parseCommand', () => {
    it('should parse valid merge command', () => {
      const result = parseCommand('/lysbot merge');
      expect(result).toEqual({ overrideApprovalRequirement: false });
    });

    it('should parse merge command with override flag', () => {
      const result = parseCommand('/lysbot merge --override-approval-requirement');
      expect(result).toEqual({ overrideApprovalRequirement: true });
    });

    it('should return null for invalid command', () => {
      expect(parseCommand('/lysbot something')).toBeNull();
      expect(parseCommand('random text')).toBeNull();
    });

    it('should return null for invalid flags', () => {
      const result = parseCommand('/lysbot merge --invalid-flag');
      expect(result).toBeNull();
    });

    it('should handle command with extra whitespace', () => {
      const result = parseCommand('  /lysbot   merge  ');
      expect(result).toEqual({ overrideApprovalRequirement: false });
    });
  });

  describe('isBot', () => {
    it('should return true for Bot user type', () => {
      expect(isBot('Bot')).toBe(true);
    });

    it('should return false for User type', () => {
      expect(isBot('User')).toBe(false);
    });

    it('should return false for other types', () => {
      expect(isBot('Organization')).toBe(false);
    });
  });

  describe('hasValidAuthorAssociation', () => {
    it('should return true for OWNER', () => {
      expect(hasValidAuthorAssociation('OWNER')).toBe(true);
    });

    it('should return true for MEMBER', () => {
      expect(hasValidAuthorAssociation('MEMBER')).toBe(true);
    });

    it('should return true for COLLABORATOR', () => {
      expect(hasValidAuthorAssociation('COLLABORATOR')).toBe(true);
    });

    it('should return false for CONTRIBUTOR', () => {
      expect(hasValidAuthorAssociation('CONTRIBUTOR')).toBe(false);
    });

    it('should return false for NONE', () => {
      expect(hasValidAuthorAssociation('NONE')).toBe(false);
    });
  });

  describe('hasValidPermission', () => {
    it('should return true for admin permission', () => {
      expect(hasValidPermission('admin')).toBe(true);
    });

    it('should return true for maintain permission', () => {
      expect(hasValidPermission('maintain')).toBe(true);
    });

    it('should return true for write permission', () => {
      expect(hasValidPermission('write')).toBe(true);
    });

    it('should return false for read permission', () => {
      expect(hasValidPermission('read')).toBe(false);
    });

    it('should return false for none permission', () => {
      expect(hasValidPermission('none')).toBe(false);
    });
  });

  describe('determineMergeMethod', () => {
    const config = createMockConfig();

    it('should use merge for release branch head', () => {
      const result = determineMergeMethod('release/v1.0', 'develop', config);
      expect(result.method).toBe('merge');
      expect(result.reason).toContain('release branch');
    });

    it('should use merge for sync branch head', () => {
      const result = determineMergeMethod('fix/sync/branch', 'develop', config);
      expect(result.method).toBe('merge');
      expect(result.reason).toContain('sync branch');
    });

    it('should use squash for release branch base', () => {
      const result = determineMergeMethod('feature/test', 'release/v1.0', config);
      expect(result.method).toBe('squash');
      expect(result.reason).toContain('release branch');
    });

    it('should use squash for develop base', () => {
      const result = determineMergeMethod('feature/test', 'develop', config);
      expect(result.method).toBe('squash');
      expect(result.reason).toContain('develop');
    });

    it('should use merge as default', () => {
      const result = determineMergeMethod('feature/test', 'main', config);
      expect(result.method).toBe('merge');
      expect(result.reason).toContain('Default merge commit');
    });
  });

  describe('validatePRState', () => {
    it('should pass for open, unlocked, non-draft PR', () => {
      const prData = createMockPullRequestData();
      const checks = validatePRState(prData);
      expect(checks).toHaveLength(1);
      expect(checks[0].passed).toBe(true);
    });

    it('should fail for closed PR', () => {
      const prData = createMockPullRequestData({ state: 'closed' });
      const checks = validatePRState(prData);
      expect(checks[0].passed).toBe(false);
      expect(checks[0].details).toContain('closed');
    });

    it('should fail for locked PR', () => {
      const prData = createMockPullRequestData({ locked: true });
      const checks = validatePRState(prData);
      expect(checks[0].passed).toBe(false);
      expect(checks[0].details).toContain('locked');
    });

    it('should fail for draft PR', () => {
      const prData = createMockPullRequestData({ draft: true });
      const checks = validatePRState(prData);
      expect(checks[0].passed).toBe(false);
      expect(checks[0].details).toContain('draft');
    });

    it('should provide multiple failure reasons', () => {
      const prData = createMockPullRequestData({
        state: 'closed',
        locked: true,
        draft: true,
      });
      const checks = validatePRState(prData);
      expect(checks[0].passed).toBe(false);
      expect(checks[0].details).toContain('closed');
      expect(checks[0].details).toContain('locked');
      expect(checks[0].details).toContain('draft');
    });
  });

  describe('isConventionalCommitTitle', () => {
    it('should return true for valid conventional commit', () => {
      expect(isConventionalCommitTitle('feat: add new feature')).toBe(true);
      expect(isConventionalCommitTitle('fix: resolve bug')).toBe(true);
      expect(isConventionalCommitTitle('docs: update readme')).toBe(true);
      expect(isConventionalCommitTitle('chore: update dependencies')).toBe(true);
    });

    it('should return true for conventional commit with scope', () => {
      expect(isConventionalCommitTitle('feat(api): add endpoint')).toBe(true);
      expect(isConventionalCommitTitle('fix(auth): resolve login issue')).toBe(true);
    });

    it('should return true for breaking change', () => {
      expect(isConventionalCommitTitle('feat!: breaking change')).toBe(true);
      expect(isConventionalCommitTitle('fix(api)!: breaking fix')).toBe(true);
    });

    it('should return false for invalid format', () => {
      expect(isConventionalCommitTitle('Add new feature')).toBe(false);
      expect(isConventionalCommitTitle('feature: add something')).toBe(false);
      expect(isConventionalCommitTitle('feat:')).toBe(false);
    });
  });

  describe('getMergeableStateDescription', () => {
    it('should return description for dirty state', () => {
      const desc = getMergeableStateDescription('dirty');
      expect(desc).toContain('conflicts');
    });

    it('should return description for blocked state', () => {
      const desc = getMergeableStateDescription('blocked');
      expect(desc).toContain('blocked');
    });

    it('should return description for clean state', () => {
      const desc = getMergeableStateDescription('clean');
      expect(desc).toContain('ready');
    });

    it('should return default for unknown state', () => {
      const desc = getMergeableStateDescription('unknown_state');
      expect(desc).toContain('mergeable_state');
    });
  });
});
