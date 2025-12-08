/**
 * validation.test.ts - Unit tests for validation functions
 *
 * Tests cover all pure validation and business logic functions.
 */

import { describe, it, expect } from 'vitest';
import type { LysbotMergeConfig, PullRequestData, CheckResult } from './types';
import { TWEMOJI } from './constants';
import {
  isLysbotMergeCommand,
  parseLysbotMergeCommand,
  isBot,
  hasValidAuthorAssociation,
  hasValidPermission,
  determineMergeMethod,
  validatePRState,
  getMergeableStateDescription,
  buildCheckResultsMarkdown,
  isConventionalCommitTitle,
  waitBeforeRetryMs,
} from './validation';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Creates a default config for tests.
 */
function createConfig(overrides: Partial<LysbotMergeConfig> = {}): LysbotMergeConfig {
  return {
    releaseBranchPrefix: 'release/',
    developBranch: 'develop',
    syncBranchPrefix: 'fix/sync/',
    mergeableRetryCount: 5,
    mergeableRetryInterval: 10,
    ...overrides,
  };
}

/**
 * Creates a default PR data object for tests.
 */
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

// =============================================================================
// Tests for isLysbotMergeCommand
// =============================================================================

describe('isLysbotMergeCommand', () => {
  describe('valid command patterns', () => {
    it('matches exact "/lysbot merge" command', () => {
      expect(isLysbotMergeCommand('/lysbot merge')).toBe(true);
    });

    it('matches with leading whitespace (space/tab/newline)', () => {
      expect(isLysbotMergeCommand('  /lysbot merge')).toBe(true);
      expect(isLysbotMergeCommand('\t/lysbot merge')).toBe(true);
      expect(isLysbotMergeCommand('\n/lysbot merge')).toBe(true);
    });

    it('matches with trailing whitespace (space/tab/newline)', () => {
      expect(isLysbotMergeCommand('/lysbot merge  ')).toBe(true);
      expect(isLysbotMergeCommand('/lysbot merge\t')).toBe(true);
      expect(isLysbotMergeCommand('/lysbot merge\n')).toBe(true);
    });

    it('matches with multiple spaces between words', () => {
      expect(isLysbotMergeCommand('/lysbot  merge')).toBe(true);
      expect(isLysbotMergeCommand('/lysbot   merge')).toBe(true);
      expect(isLysbotMergeCommand('/lysbot\tmerge')).toBe(true);
    });

    it('matches with --override-approval-requirement flag', () => {
      expect(isLysbotMergeCommand('/lysbot merge --override-approval-requirement')).toBe(true);
      expect(isLysbotMergeCommand('  /lysbot merge --override-approval-requirement  ')).toBe(true);
    });
  });

  describe('invalid command patterns', () => {
    it('rejects command with unknown arguments or flags', () => {
      expect(isLysbotMergeCommand('/lysbot merge now')).toBe(false);
      expect(isLysbotMergeCommand('/lysbot merge --force')).toBe(false);
      expect(isLysbotMergeCommand('/lysbot merge --unknown-flag')).toBe(false);
    });

    it('rejects partial or malformed commands', () => {
      expect(isLysbotMergeCommand('/lysbot')).toBe(false);
      expect(isLysbotMergeCommand('/lysbot merg')).toBe(false);
      expect(isLysbotMergeCommand('lysbot merge')).toBe(false);
    });

    it('rejects when command is embedded in other text', () => {
      expect(isLysbotMergeCommand('Please /lysbot merge this')).toBe(false);
      expect(isLysbotMergeCommand('Run /lysbot merge')).toBe(false);
    });

    it('is case-sensitive (uppercase rejected)', () => {
      expect(isLysbotMergeCommand('/LYSBOT MERGE')).toBe(false);
      expect(isLysbotMergeCommand('/Lysbot Merge')).toBe(false);
    });
  });
});

// =============================================================================
// Tests for parseLysbotMergeCommand
// =============================================================================

describe('parseLysbotMergeCommand', () => {
  describe('valid commands', () => {
    it('parses basic command without flags', () => {
      const result = parseLysbotMergeCommand('/lysbot merge');
      expect(result).not.toBeNull();
      expect(result?.overrideApprovalRequirement).toBe(false);
    });

    it('parses command with --override-approval-requirement flag', () => {
      const result = parseLysbotMergeCommand('/lysbot merge --override-approval-requirement');
      expect(result).not.toBeNull();
      expect(result?.overrideApprovalRequirement).toBe(true);
    });

    it('parses command with flag and extra whitespace', () => {
      const result = parseLysbotMergeCommand('  /lysbot merge   --override-approval-requirement  ');
      expect(result).not.toBeNull();
      expect(result?.overrideApprovalRequirement).toBe(true);
    });
  });

  describe('invalid commands', () => {
    it('returns null for non-command text', () => {
      expect(parseLysbotMergeCommand('hello world')).toBeNull();
    });

    it('returns null for command with unknown flags', () => {
      expect(parseLysbotMergeCommand('/lysbot merge --unknown-flag')).toBeNull();
    });

    it('returns null for malformed commands', () => {
      expect(parseLysbotMergeCommand('/lysbot')).toBeNull();
      expect(parseLysbotMergeCommand('lysbot merge')).toBeNull();
    });
  });
});

// =============================================================================
// Tests for isBot
// =============================================================================

describe('isBot', () => {
  it('should return true for Bot user type', () => {
    expect(isBot('Bot')).toBe(true);
  });

  it('should return false for User type', () => {
    expect(isBot('User')).toBe(false);
  });

  it('should return false for other types', () => {
    expect(isBot('Organization')).toBe(false);
    expect(isBot('Mannequin')).toBe(false);
    expect(isBot('')).toBe(false);
  });
});

// =============================================================================
// Tests for hasValidAuthorAssociation
// =============================================================================

describe('hasValidAuthorAssociation', () => {
  describe('allowed associations (can use /lysbot merge)', () => {
    it('allows OWNER (repository/org owner)', () => {
      expect(hasValidAuthorAssociation('OWNER')).toBe(true);
    });

    it('allows MEMBER (organization member)', () => {
      expect(hasValidAuthorAssociation('MEMBER')).toBe(true);
    });

    it('allows COLLABORATOR (explicit repo access)', () => {
      expect(hasValidAuthorAssociation('COLLABORATOR')).toBe(true);
    });
  });

  describe('rejected associations', () => {
    it('rejects CONTRIBUTOR (PR author without collaborator status)', () => {
      expect(hasValidAuthorAssociation('CONTRIBUTOR')).toBe(false);
    });

    it('rejects FIRST_TIME_CONTRIBUTOR', () => {
      expect(hasValidAuthorAssociation('FIRST_TIME_CONTRIBUTOR')).toBe(false);
    });

    it('rejects FIRST_TIMER', () => {
      expect(hasValidAuthorAssociation('FIRST_TIMER')).toBe(false);
    });

    it('rejects NONE (no association)', () => {
      expect(hasValidAuthorAssociation('NONE')).toBe(false);
    });
  });
});

// =============================================================================
// Tests for hasValidPermission
// =============================================================================

describe('hasValidPermission', () => {
  describe('allowed permissions (can use /lysbot merge)', () => {
    it('allows admin permission', () => {
      expect(hasValidPermission('admin')).toBe(true);
    });

    it('allows maintain permission', () => {
      expect(hasValidPermission('maintain')).toBe(true);
    });

    it('allows write permission', () => {
      expect(hasValidPermission('write')).toBe(true);
    });
  });

  describe('rejected permissions', () => {
    it('rejects read permission', () => {
      expect(hasValidPermission('read')).toBe(false);
    });

    it('rejects none (no permission)', () => {
      expect(hasValidPermission('none')).toBe(false);
    });
  });
});

// =============================================================================
// Tests for determineMergeMethod
// =============================================================================

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

// =============================================================================
// Tests for validatePRState
// =============================================================================

describe('validatePRState', () => {
  describe('valid PR state', () => {
    it('passes all checks for valid open PR', () => {
      const prData = createPRData();
      const checks = validatePRState(prData);

      expect(checks).toHaveLength(3);
      expect(checks.every((c) => c.passed)).toBe(true);
    });
  });

  describe('invalid PR states', () => {
    it('fails open check when PR is closed', () => {
      const prData = createPRData({ state: 'closed' });
      const checks = validatePRState(prData);

      const openCheck = checks.find((c) => c.name === 'PR is open');
      expect(openCheck?.passed).toBe(false);
      expect(openCheck?.details).toContain('closed');
    });

    it('fails unlocked check when PR is locked', () => {
      const prData = createPRData({ locked: true });
      const checks = validatePRState(prData);

      const lockedCheck = checks.find((c) => c.name === 'PR is unlocked');
      expect(lockedCheck?.passed).toBe(false);
      expect(lockedCheck?.details).toContain('locked');
    });

    it('fails ready check when PR is a draft', () => {
      const prData = createPRData({ draft: true });
      const checks = validatePRState(prData);

      const draftCheck = checks.find((c) => c.name === 'PR is ready for review');
      expect(draftCheck?.passed).toBe(false);
      expect(draftCheck?.details).toContain('draft');
    });
  });
});

// =============================================================================
// Tests for getMergeableStateDescription
// =============================================================================

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

// =============================================================================
// Tests for buildCheckResultsMarkdown
// =============================================================================

describe('buildCheckResultsMarkdown', () => {
  it('should include check icon for passed checks', () => {
    const checks: CheckResult[] = [{ name: 'Test check', passed: true }];
    const markdown = buildCheckResultsMarkdown(checks);

    expect(markdown).toContain(TWEMOJI.CHECK);
    expect(markdown).toContain('Test check');
  });

  it('should include cross icon for failed checks', () => {
    const checks: CheckResult[] = [{ name: 'Test check', passed: false, details: 'reason' }];
    const markdown = buildCheckResultsMarkdown(checks);

    expect(markdown).toContain(TWEMOJI.CROSS);
    expect(markdown).toContain('Test check');
    expect(markdown).toContain('(reason)');
  });

  it('should format multiple checks correctly', () => {
    const checks: CheckResult[] = [
      { name: 'Check 1', passed: true },
      { name: 'Check 2', passed: false, details: 'failed' },
      { name: 'Check 3', passed: true },
    ];
    const markdown = buildCheckResultsMarkdown(checks);

    expect(markdown.split('\n')).toHaveLength(3);
    expect(markdown).toContain('Check 1');
    expect(markdown).toContain('Check 2');
    expect(markdown).toContain('Check 3');
  });

  it('should include warning icon for failed optional checks', () => {
    const checks: CheckResult[] = [{ name: 'Optional check', passed: false, details: 'not required', optional: true }];
    const markdown = buildCheckResultsMarkdown(checks);

    expect(markdown).toContain(TWEMOJI.WARNING);
    expect(markdown).toContain('Optional check');
    expect(markdown).toContain('(not required)');
  });

  it('should include check icon for passed optional checks', () => {
    const checks: CheckResult[] = [{ name: 'Optional check', passed: true, optional: true }];
    const markdown = buildCheckResultsMarkdown(checks);

    expect(markdown).toContain(TWEMOJI.CHECK);
    expect(markdown).toContain('Optional check');
  });

  it('should format mixed required and optional checks correctly', () => {
    const checks: CheckResult[] = [
      { name: 'Required passing', passed: true },
      { name: 'Required failing', passed: false, details: 'error' },
      { name: 'Optional passing', passed: true, optional: true },
      { name: 'Optional failing', passed: false, details: 'warning', optional: true },
    ];
    const markdown = buildCheckResultsMarkdown(checks);

    expect(markdown.split('\n')).toHaveLength(4);
    // Required passing - check mark
    expect(markdown).toContain(TWEMOJI.CHECK);
    // Required failing - cross
    expect(markdown).toContain(TWEMOJI.CROSS);
    // Optional failing - warning
    expect(markdown).toContain(TWEMOJI.WARNING);
  });
});

// =============================================================================
// Tests for isConventionalCommitTitle
// =============================================================================

describe('isConventionalCommitTitle', () => {
  describe('valid Conventional Commits titles', () => {
    it('matches simple type: description format', () => {
      expect(isConventionalCommitTitle('feat: add new feature')).toBe(true);
      expect(isConventionalCommitTitle('fix: resolve bug')).toBe(true);
      expect(isConventionalCommitTitle('docs: update readme')).toBe(true);
    });

    it('matches type(scope): description format', () => {
      expect(isConventionalCommitTitle('feat(auth): add login')).toBe(true);
      expect(isConventionalCommitTitle('fix(api): resolve error')).toBe(true);
      expect(isConventionalCommitTitle('docs(readme): update installation')).toBe(true);
    });

    it('matches breaking changes without scope using "type!: description"', () => {
      expect(isConventionalCommitTitle('feat!: add new feature')).toBe(true);
      expect(isConventionalCommitTitle('fix!: resolve bug')).toBe(true);
      expect(isConventionalCommitTitle('docs!: update readme')).toBe(true);
    });

    it('matches breaking changes with scope using "type(scope)!: description"', () => {
      expect(isConventionalCommitTitle('feat(auth)!: add login')).toBe(true);
      expect(isConventionalCommitTitle('fix(api)!: resolve error')).toBe(true);
      expect(isConventionalCommitTitle('docs(readme)!: update installation')).toBe(true);
    });

    it('matches all 12 supported types', () => {
      const types = [
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
      for (const type of types) {
        expect(isConventionalCommitTitle(`${type}: some description`)).toBe(true);
        expect(isConventionalCommitTitle(`${type}(scope): some description`)).toBe(true);
        expect(isConventionalCommitTitle(`${type}!: some description`)).toBe(true);
        expect(isConventionalCommitTitle(`${type}(scope)!: some description`)).toBe(true);
      }
    });

    it('matches with complex scope names', () => {
      expect(isConventionalCommitTitle('feat(user-management): add feature')).toBe(true);
      expect(isConventionalCommitTitle('fix(api/v2): resolve bug')).toBe(true);
    });
  });

  describe('invalid titles', () => {
    it('rejects titles without colon', () => {
      expect(isConventionalCommitTitle('feat add new feature')).toBe(false);
    });

    it('rejects titles without type', () => {
      expect(isConventionalCommitTitle(': add new feature')).toBe(false);
      expect(isConventionalCommitTitle('Add new feature')).toBe(false);
    });

    it('rejects unsupported types', () => {
      expect(isConventionalCommitTitle('feature: add new feature')).toBe(false);
      expect(isConventionalCommitTitle('bugfix: resolve issue')).toBe(false);
      expect(isConventionalCommitTitle('update: change something')).toBe(false);
    });

    it('rejects empty description', () => {
      expect(isConventionalCommitTitle('feat:')).toBe(false);
      expect(isConventionalCommitTitle('feat: ')).toBe(false);
    });

    it('rejects empty scope', () => {
      expect(isConventionalCommitTitle('feat(): description')).toBe(false);
    });

    it('rejects when type has leading text', () => {
      expect(isConventionalCommitTitle('prefix feat: add feature')).toBe(false);
    });

    it('rejects missing colon with "!"', () => {
      expect(isConventionalCommitTitle('feat! breaking change')).toBe(false);
      expect(isConventionalCommitTitle('feat(scope)! breaking change')).toBe(false);
    });

    it('rejects misplaced "!" marker', () => {
      expect(isConventionalCommitTitle('feat !: breaking change')).toBe(false);
      expect(isConventionalCommitTitle('feat(!): breaking change')).toBe(false);
      expect(isConventionalCommitTitle('feat(scope!): breaking change')).toBe(false);
      expect(isConventionalCommitTitle('feat(scope)! : breaking change')).toBe(false);
    });
  });
});

// =============================================================================
// Tests for waitBeforeRetryMs function
// =============================================================================

describe('waitBeforeRetryMs', () => {
  it('should resolve after specified milliseconds', async () => {
    const start = Date.now();
    await waitBeforeRetryMs(50);
    const elapsed = Date.now() - start;
    // Allow some tolerance for timing
    expect(elapsed).toBeGreaterThanOrEqual(40);
    expect(elapsed).toBeLessThan(200);
  });

  it('should resolve immediately for 0ms', async () => {
    const start = Date.now();
    await waitBeforeRetryMs(0);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});
