/**
 * lysbot-merge.test.ts - Unit tests for lysbot-merge action
 *
 * Tests cover all pure logic functions and validate the core business rules.
 * GitHub API interactions are mocked for isolation.
 */

import { describe, it, expect, vi, type MockedFunction } from 'vitest';
import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
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
  TWEMOJI,
  COMMAND_REGEX,
  CONVENTIONAL_COMMIT_TYPES,
  CONVENTIONAL_COMMIT_REGEX,
  type LysbotMergeConfig,
  type PullRequestData,
  type CheckResult,
  type Octokit,
  type MergeOptions,
  addReaction,
  postComment,
  getCollaboratorPermission,
  fetchPullRequestData,
  dismissReview,
  countUnresolvedThreads,
  mergePullRequest,
  lysbotMerge,
  waitBeforeRetryMs,
  type EventContext,
} from './lysbot-merge';

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

/**
 * Creates a mock Octokit instance for tests.
 */
function createMockOctokit(): Octokit {
  return {
    rest: {
      reactions: {
        createForIssueComment: vi.fn().mockResolvedValue({}),
      },
      issues: {
        createComment: vi.fn().mockResolvedValue({}),
      },
      repos: {
        getCollaboratorPermissionLevel: vi.fn().mockResolvedValue({
          data: { permission: 'write' },
        }),
      },
      pulls: {
        get: vi.fn().mockResolvedValue({
          data: {
            state: 'open',
            locked: false,
            draft: false,
            merged: false,
            mergeable: true,
            mergeable_state: 'clean',
            head: {
              sha: 'abc1234567890',
              ref: 'feature/test',
              repo: { fork: false, owner: { id: 1 } },
            },
            base: {
              ref: 'develop',
              repo: { owner: { id: 1 } },
            },
            user: { login: 'testuser' },
            title: 'feat: test pull request',
          },
        }),
        listReviews: vi.fn().mockResolvedValue({ data: [] }),
        dismissReview: vi.fn().mockResolvedValue({}),
        merge: vi.fn().mockResolvedValue({
          data: { sha: 'merge123456789', merged: true, message: 'Pull request successfully merged' },
        }),
      },
    },
    paginate: vi.fn().mockResolvedValue([]),
    graphql: vi.fn().mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [],
          },
        },
      },
    }),
  } as unknown as Octokit;
}

/**
 * Creates a default event context for tests.
 */
function createEventContext(overrides: Partial<EventContext> = {}): EventContext {
  return {
    owner: 'testowner',
    repo: 'testrepo',
    prNumber: 1,
    commentId: 123,
    commentBody: '/lysbot merge',
    actor: 'testactor',
    userType: 'User',
    authorAssociation: 'MEMBER',
    serverUrl: 'https://github.com',
    runId: 12345,
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
// Tests for CONVENTIONAL_COMMIT_TYPES constant
// =============================================================================

describe('CONVENTIONAL_COMMIT_TYPES', () => {
  it('should contain exactly 12 types', () => {
    expect(CONVENTIONAL_COMMIT_TYPES).toHaveLength(12);
  });

  it('should include all required types', () => {
    const expectedTypes = [
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
    for (const type of expectedTypes) {
      expect(CONVENTIONAL_COMMIT_TYPES).toContain(type);
    }
  });
});

// =============================================================================
// Tests for CONVENTIONAL_COMMIT_REGEX constant
// =============================================================================

describe('CONVENTIONAL_COMMIT_REGEX', () => {
  it('should be a valid regex pattern', () => {
    expect(CONVENTIONAL_COMMIT_REGEX).toBeInstanceOf(RegExp);
  });

  it('should match the same patterns as isConventionalCommitTitle', () => {
    const testCases = [
      { input: 'feat: add feature', expected: true },
      { input: 'fix(auth): resolve bug', expected: true },
      { input: 'Update README', expected: false },
      { input: 'feature: not supported', expected: false },
    ];

    for (const { input, expected } of testCases) {
      expect(CONVENTIONAL_COMMIT_REGEX.test(input)).toBe(expected);
    }
  });
});

// =============================================================================
// Tests for COMMAND_REGEX constant
// =============================================================================

describe('COMMAND_REGEX', () => {
  it('should be a valid regex pattern', () => {
    expect(COMMAND_REGEX).toBeInstanceOf(RegExp);
  });

  it('should match basic command patterns and capture optional flags', () => {
    // Note: COMMAND_REGEX now captures optional flags after "merge"
    // The actual flag validation is done in isLysbotMergeCommand
    const testCases = [
      { input: '/lysbot merge', expected: true },
      { input: '  /lysbot merge', expected: true },
      { input: '/lysbot merge  ', expected: true },
      { input: '/lysbot  merge', expected: true },
      { input: '/lysbot merge --override-approval-requirement', expected: true },
      { input: '/lysbot merge now', expected: true }, // Regex matches, but isLysbotMergeCommand rejects
      { input: 'run /lysbot merge', expected: false }, // Text before command
    ];

    for (const { input, expected } of testCases) {
      expect(COMMAND_REGEX.test(input)).toBe(expected);
    }
  });

  it('should capture flags from command', () => {
    const match = COMMAND_REGEX.exec('/lysbot merge --override-approval-requirement');
    expect(match).not.toBeNull();
    expect(match?.[1]?.trim()).toBe('--override-approval-requirement');
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

// =============================================================================
// Tests for GitHub API Functions (with mocks)
// =============================================================================

describe('addReaction', () => {
  it('should call createForIssueComment with correct parameters', async () => {
    const octokit = createMockOctokit();
    await addReaction(octokit, 'owner', 'repo', 123, 'eyes');

    expect(octokit.rest.reactions.createForIssueComment).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      comment_id: 123,
      content: 'eyes',
    });
  });

  it('should not throw on error', async () => {
    const octokit = createMockOctokit();
    (
      octokit.rest.reactions.createForIssueComment as MockedFunction<
        typeof octokit.rest.reactions.createForIssueComment
      >
    ).mockRejectedValue(new Error('Already exists'));

    // Should not throw
    await expect(addReaction(octokit, 'owner', 'repo', 123, 'eyes')).resolves.toBeUndefined();
  });
});

describe('postComment', () => {
  it('should call createComment with correct parameters', async () => {
    const octokit = createMockOctokit();
    await postComment(octokit, 'owner', 'repo', 1, 'Test body');

    expect(octokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: 'owner',
      repo: 'repo',
      issue_number: 1,
      body: 'Test body',
    });
  });
});

describe('getCollaboratorPermission', () => {
  it('should return permission level on success', async () => {
    const octokit = createMockOctokit();
    const permission = await getCollaboratorPermission(octokit, 'owner', 'repo', 'user');

    expect(permission).toBe('write');
  });

  it('should return none on error', async () => {
    const octokit = createMockOctokit();
    (
      octokit.rest.repos.getCollaboratorPermissionLevel as MockedFunction<
        typeof octokit.rest.repos.getCollaboratorPermissionLevel
      >
    ).mockRejectedValue(new Error('Not found'));

    const permission = await getCollaboratorPermission(octokit, 'owner', 'repo', 'user');
    expect(permission).toBe('none');
  });
});

describe('fetchPullRequestData', () => {
  it('should parse PR data correctly', async () => {
    const octokit = createMockOctokit();
    const prData = await fetchPullRequestData(octokit, 'owner', 'repo', 1);

    expect(prData.state).toBe('open');
    expect(prData.locked).toBe(false);
    expect(prData.draft).toBe(false);
    expect(prData.merged).toBe(false);
    expect(prData.headSha).toBe('abc1234567890');
    expect(prData.headRef).toBe('feature/test');
    expect(prData.baseRef).toBe('develop');
    expect(prData.isFork).toBe(false);
  });

  it('should detect fork PRs correctly', async () => {
    const octokit = createMockOctokit();
    (octokit.rest.pulls.get as MockedFunction<typeof octokit.rest.pulls.get>).mockResolvedValue({
      data: {
        state: 'open',
        locked: false,
        draft: false,
        merged: false,
        mergeable: true,
        mergeable_state: 'clean',
        head: {
          sha: 'abc',
          ref: 'feature/test',
          repo: { fork: true, owner: { id: 2 } },
        },
        base: {
          ref: 'develop',
          repo: { owner: { id: 1 } },
        },
        user: { login: 'testuser' },
        title: 'feat: test pull request',
      },
    } as unknown as Awaited<ReturnType<typeof octokit.rest.pulls.get>>);

    const prData = await fetchPullRequestData(octokit, 'owner', 'repo', 1);
    expect(prData.isFork).toBe(true);
  });
});

describe('dismissReview', () => {
  it('should return true on success', async () => {
    const octokit = createMockOctokit();
    const result = await dismissReview(octokit, 'owner', 'repo', 1, 123, 'Stale');

    expect(result).toBe(true);
  });

  it('should return false on error', async () => {
    const octokit = createMockOctokit();
    (octokit.rest.pulls.dismissReview as MockedFunction<typeof octokit.rest.pulls.dismissReview>).mockRejectedValue(
      new Error('Forbidden'),
    );

    const result = await dismissReview(octokit, 'owner', 'repo', 1, 123, 'Stale');
    expect(result).toBe(false);
  });
});

describe('countUnresolvedThreads', () => {
  it('should count unresolved threads across pages', async () => {
    const octokit = createMockOctokit();
    let callCount = 0;
    (octokit.graphql as unknown as MockedFunction<typeof octokit.graphql>).mockImplementation(async () => {
      callCount++;
      if (callCount === 1) {
        return {
          repository: {
            pullRequest: {
              reviewThreads: {
                pageInfo: { hasNextPage: true, endCursor: 'cursor1' },
                nodes: [{ isResolved: false }, { isResolved: true }],
              },
            },
          },
        };
      }
      return {
        repository: {
          pullRequest: {
            reviewThreads: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [{ isResolved: false }],
            },
          },
        },
      };
    });

    const count = await countUnresolvedThreads(octokit, 'owner', 'repo', 1);
    expect(count).toBe(2);
  });
});

describe('mergePullRequest', () => {
  it('should return success on successful merge', async () => {
    const octokit = createMockOctokit();
    const result = await mergePullRequest(octokit, 'owner', 'repo', 1, 'squash', 'abc123', 'Merge message');

    expect(result.success).toBe(true);
    expect(result.mergeCommitSha).toBe('merge123456789');
  });

  it('should return error message on failure', async () => {
    const octokit = createMockOctokit();
    (octokit.rest.pulls.merge as MockedFunction<typeof octokit.rest.pulls.merge>).mockRejectedValue(
      new Error('Merge conflict'),
    );

    const result = await mergePullRequest(octokit, 'owner', 'repo', 1, 'squash', 'abc123', 'Merge message');

    expect(result.success).toBe(false);
    expect(result.error).toContain('Merge conflict');
  });
});

// =============================================================================
// Tests for lysbotMerge main function
// =============================================================================

describe('lysbotMerge', () => {
  describe('command and user validation', () => {
    it('skips processing for bot comments', async () => {
      const octokit = createMockOctokit();
      const context = createEventContext({ userType: 'Bot' });
      const config = createConfig();

      const result = await lysbotMerge(octokit, context, config);

      expect(result.status).toBe('skipped');
      expect(result.message).toContain('bot');
    });

    it('skips processing for non-matching command', async () => {
      const octokit = createMockOctokit();
      const context = createEventContext({ commentBody: 'Hello world' });
      const config = createConfig();

      const result = await lysbotMerge(octokit, context, config);

      expect(result.status).toBe('skipped');
      expect(result.message).toContain('not matched');
    });

    it('fails for users without valid author association', async () => {
      const octokit = createMockOctokit();
      const context = createEventContext({ authorAssociation: 'NONE' });
      const config = createConfig();

      const result = await lysbotMerge(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('author association');
    });

    it('fails for users without write permission', async () => {
      const octokit = createMockOctokit();
      (
        octokit.rest.repos.getCollaboratorPermissionLevel as MockedFunction<
          typeof octokit.rest.repos.getCollaboratorPermissionLevel
        >
      ).mockResolvedValue({
        data: { permission: 'read' },
      } as Awaited<ReturnType<typeof octokit.rest.repos.getCollaboratorPermissionLevel>>);
      const context = createEventContext();
      const config = createConfig();

      const result = await lysbotMerge(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('permissions');
    });
  });

  describe('PR state validation', () => {
    it('fails for PRs from forked repositories', async () => {
      const octokit = createMockOctokit();
      (octokit.rest.pulls.get as MockedFunction<typeof octokit.rest.pulls.get>).mockResolvedValue({
        data: {
          state: 'open',
          locked: false,
          draft: false,
          merged: false,
          mergeable: true,
          mergeable_state: 'clean',
          head: {
            sha: 'abc',
            ref: 'feature/test',
            repo: { fork: true, owner: { id: 2 } },
          },
          base: {
            ref: 'develop',
            repo: { owner: { id: 1 } },
          },
          user: { login: 'testuser' },
          title: 'feat: test pull request',
        },
      } as unknown as Awaited<ReturnType<typeof octokit.rest.pulls.get>>);
      const context = createEventContext();
      const config = createConfig();

      const result = await lysbotMerge(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('Fork');
    });

    it('returns already_merged for previously merged PRs', async () => {
      const octokit = createMockOctokit();
      (octokit.rest.pulls.get as MockedFunction<typeof octokit.rest.pulls.get>).mockResolvedValue({
        data: {
          state: 'closed',
          locked: false,
          draft: false,
          merged: true,
          mergeable: null,
          mergeable_state: 'unknown',
          head: {
            sha: 'abc',
            ref: 'feature/test',
            repo: { fork: false, owner: { id: 1 } },
          },
          base: {
            ref: 'develop',
            repo: { owner: { id: 1 } },
          },
          user: { login: 'testuser' },
          title: 'feat: test pull request',
        },
      } as unknown as Awaited<ReturnType<typeof octokit.rest.pulls.get>>);
      const context = createEventContext();
      const config = createConfig();

      const result = await lysbotMerge(octokit, context, config);

      expect(result.status).toBe('already_merged');
    });
  });

  describe('merge execution', () => {
    it('successfully merges PR with valid approval (uses squash for develop base)', async () => {
      const octokit = createMockOctokit();

      // Mock approved review from another user
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([
        {
          id: 1,
          state: 'APPROVED',
          commit_id: 'abc1234567890',
          user: { login: 'reviewer' },
        },
      ]);

      const context = createEventContext();
      const config = createConfig();

      const result = await lysbotMerge(octokit, context, config);

      expect(result.status).toBe('merged');
      expect(result.mergeMethod).toBe('squash'); // base is develop
    });

    it('fails when no valid approvals exist', async () => {
      const octokit = createMockOctokit();

      // No approved reviews
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([]);

      const context = createEventContext();
      const config = createConfig();

      const result = await lysbotMerge(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('checks failed');
    });

    it('Case A: fails when no approvals and no override flag, shows cross icon', async () => {
      const octokit = createMockOctokit();

      // No approved reviews
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([]);

      const context = createEventContext({ commentBody: '/lysbot merge' });
      const config = createConfig();

      const result = await lysbotMerge(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('checks failed');

      // Verify the cross icon is used for approval check
      const commentCalls = (
        octokit.rest.issues.createComment as MockedFunction<typeof octokit.rest.issues.createComment>
      ).mock.calls;
      const mergeCheckComment = commentCalls.find((call) => {
        const body = call[0]?.body;
        return body?.includes('Merge checks failed');
      });
      expect(mergeCheckComment).toBeDefined();
      const commentBody = mergeCheckComment?.[0]?.body ?? '';
      expect(commentBody).toContain(TWEMOJI.CROSS);
      expect(commentBody).toContain('At least one valid approval');
      expect(commentBody).toContain('no valid approvals found');
    });

    it('Case B: succeeds with override flag when no approvals, shows warning icon', async () => {
      const octokit = createMockOctokit();

      // No approved reviews
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([]);

      const context = createEventContext({ commentBody: '/lysbot merge --override-approval-requirement' });
      const config = createConfig();

      const result = await lysbotMerge(octokit, context, config);

      expect(result.status).toBe('merged');

      // Verify the warning icon is used for approval check
      const commentCalls = (
        octokit.rest.issues.createComment as MockedFunction<typeof octokit.rest.issues.createComment>
      ).mock.calls;
      const mergeCheckComment = commentCalls.find((call) => {
        const body = call[0]?.body;
        return body?.includes('Merge checks passed');
      });
      expect(mergeCheckComment).toBeDefined();
      const commentBody = mergeCheckComment?.[0]?.body ?? '';
      expect(commentBody).toContain(TWEMOJI.WARNING);
      expect(commentBody).toContain('At least one valid approval');
      expect(commentBody).toContain('approval requirement overridden');
      expect(commentBody).toContain('--override-approval-requirement');
    });

    it('Case C: fails with override flag when other checks fail (e.g., unresolved threads)', async () => {
      const octokit = createMockOctokit();

      // No approved reviews
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([]);

      // Mock unresolved threads
      (octokit.graphql as unknown as MockedFunction<typeof octokit.graphql>).mockResolvedValue({
        repository: {
          pullRequest: {
            reviewThreads: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [{ isResolved: false }], // 1 unresolved thread
            },
          },
        },
      });

      const context = createEventContext({ commentBody: '/lysbot merge --override-approval-requirement' });
      const config = createConfig();

      const result = await lysbotMerge(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('checks failed');

      // Verify the threads check failed with cross icon
      const commentCalls = (
        octokit.rest.issues.createComment as MockedFunction<typeof octokit.rest.issues.createComment>
      ).mock.calls;
      const mergeCheckComment = commentCalls.find((call) => {
        const body = call[0]?.body;
        return body?.includes('Merge checks failed');
      });
      expect(mergeCheckComment).toBeDefined();
      const commentBody = mergeCheckComment?.[0]?.body ?? '';
      expect(commentBody).toContain('review conversations are resolved');
      expect(commentBody).toContain(TWEMOJI.CROSS);
    });

    it('Case D: title warning behavior - non-conventional title shows warning but does not block', async () => {
      const octokit = createMockOctokit();

      // Mock PR with non-conventional title
      (octokit.rest.pulls.get as MockedFunction<typeof octokit.rest.pulls.get>).mockResolvedValue({
        data: {
          state: 'open',
          locked: false,
          draft: false,
          merged: false,
          mergeable: true,
          mergeable_state: 'clean',
          head: {
            sha: 'abc1234567890',
            ref: 'feature/test',
            repo: { fork: false, owner: { id: 1 } },
          },
          base: {
            ref: 'develop',
            repo: { owner: { id: 1 } },
          },
          user: { login: 'testuser' },
          title: 'Update README', // Non-conventional title
        },
      } as unknown as Awaited<ReturnType<typeof octokit.rest.pulls.get>>);

      // Mock approved review from another user
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([
        {
          id: 1,
          state: 'APPROVED',
          commit_id: 'abc1234567890',
          user: { login: 'reviewer' },
        },
      ]);

      const context = createEventContext();
      const config = createConfig();

      const result = await lysbotMerge(octokit, context, config);

      // Should still merge successfully (conventional commits is optional)
      expect(result.status).toBe('merged');

      // Verify the warning icon was used for conventional commits check
      const commentCalls = (
        octokit.rest.issues.createComment as MockedFunction<typeof octokit.rest.issues.createComment>
      ).mock.calls;
      const hasConventionalCommitsWarning = commentCalls.some((call) => {
        const body = call[0]?.body;
        return body?.includes('Conventional Commits') && body?.includes(TWEMOJI.WARNING);
      });
      expect(hasConventionalCommitsWarning).toBe(true);
    });

    it('dismisses stale approvals without posting success notification', async () => {
      const octokit = createMockOctokit();

      // Mock PR with current HEAD
      (octokit.rest.pulls.get as MockedFunction<typeof octokit.rest.pulls.get>).mockResolvedValue({
        data: {
          state: 'open',
          locked: false,
          draft: false,
          merged: false,
          mergeable: true,
          mergeable_state: 'clean',
          head: {
            sha: 'currenthead123',
            ref: 'feature/test',
            repo: { fork: false, owner: { id: 1 } },
          },
          base: {
            ref: 'develop',
            repo: { owner: { id: 1 } },
          },
          user: { login: 'testuser' },
          title: 'feat: test pull request',
        },
      } as unknown as Awaited<ReturnType<typeof octokit.rest.pulls.get>>);

      // Mock approved review on OLD commit (stale)
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([
        {
          id: 1,
          state: 'APPROVED',
          commit_id: 'oldcommit456', // Different from currenthead123
          user: { login: 'reviewer' },
        },
      ]);

      const context = createEventContext();
      const config = createConfig();

      const result = await lysbotMerge(octokit, context, config);

      // Should dismiss the stale review
      expect(octokit.rest.pulls.dismissReview).toHaveBeenCalled();

      // Should NOT post "Stale approvals dismissed" comment (redundant with GitHub's native notification)
      // But SHOULD post "Merge checks failed" comment
      const commentCalls = (
        octokit.rest.issues.createComment as MockedFunction<typeof octokit.rest.issues.createComment>
      ).mock.calls;
      const hasStaleSuccessComment = commentCalls.some((call) => {
        const body = call[0]?.body;
        return body?.includes('Stale approvals dismissed');
      });
      expect(hasStaleSuccessComment).toBe(false);

      // Should fail because no valid approvals remain
      expect(result.status).toBe('failed');
    });

    it('handles dismiss failure and posts notification', async () => {
      const octokit = createMockOctokit();

      // Mock PR with current HEAD
      (octokit.rest.pulls.get as MockedFunction<typeof octokit.rest.pulls.get>).mockResolvedValue({
        data: {
          state: 'open',
          locked: false,
          draft: false,
          merged: false,
          mergeable: true,
          mergeable_state: 'clean',
          head: {
            sha: 'currenthead123',
            ref: 'feature/test',
            repo: { fork: false, owner: { id: 1 } },
          },
          base: {
            ref: 'develop',
            repo: { owner: { id: 1 } },
          },
          user: { login: 'testuser' },
          title: 'feat: test pull request',
        },
      } as unknown as Awaited<ReturnType<typeof octokit.rest.pulls.get>>);

      // Mock approved review on OLD commit (stale)
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([
        {
          id: 1,
          state: 'APPROVED',
          commit_id: 'oldcommit456',
          user: { login: 'reviewer' },
        },
      ]);

      // Mock dismissReview to fail
      (octokit.rest.pulls.dismissReview as MockedFunction<typeof octokit.rest.pulls.dismissReview>).mockRejectedValue(
        new Error('Forbidden'),
      );

      const context = createEventContext();
      const config = createConfig();

      const result = await lysbotMerge(octokit, context, config);

      // Should post comment about dismiss failure
      expect(octokit.rest.issues.createComment).toHaveBeenCalled();
      const commentCalls = (
        octokit.rest.issues.createComment as MockedFunction<typeof octokit.rest.issues.createComment>
      ).mock.calls;
      const hasFailureComment = commentCalls.some((call) => {
        const body = call[0]?.body;
        return body?.includes('Failed to dismiss') || body?.includes('Dismiss failures');
      });
      expect(hasFailureComment).toBe(true);

      // Should fail because no valid approvals
      expect(result.status).toBe('failed');
    });

    it('merges PR with non-conventional title but shows warning', async () => {
      const octokit = createMockOctokit();

      // Mock PR with non-conventional title
      (octokit.rest.pulls.get as MockedFunction<typeof octokit.rest.pulls.get>).mockResolvedValue({
        data: {
          state: 'open',
          locked: false,
          draft: false,
          merged: false,
          mergeable: true,
          mergeable_state: 'clean',
          head: {
            sha: 'abc1234567890',
            ref: 'feature/test',
            repo: { fork: false, owner: { id: 1 } },
          },
          base: {
            ref: 'develop',
            repo: { owner: { id: 1 } },
          },
          user: { login: 'testuser' },
          title: 'Update README', // Non-conventional title
        },
      } as unknown as Awaited<ReturnType<typeof octokit.rest.pulls.get>>);

      // Mock approved review from another user
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([
        {
          id: 1,
          state: 'APPROVED',
          commit_id: 'abc1234567890',
          user: { login: 'reviewer' },
        },
      ]);

      const context = createEventContext();
      const config = createConfig();

      const result = await lysbotMerge(octokit, context, config);

      // Should still merge successfully (conventional commits is optional)
      expect(result.status).toBe('merged');
      expect(result.mergeMethod).toBe('squash');

      // Verify the warning icon was used in the comment
      const commentCalls = (
        octokit.rest.issues.createComment as MockedFunction<typeof octokit.rest.issues.createComment>
      ).mock.calls;
      const hasConventionalCommitsCheck = commentCalls.some((call) => {
        const body = call[0]?.body;
        return body?.includes('Conventional Commits') && body?.includes(TWEMOJI.WARNING);
      });
      expect(hasConventionalCommitsCheck).toBe(true);
    });

    it('merges PR with conventional title and shows check mark', async () => {
      const octokit = createMockOctokit();

      // Mock approved review from another user
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([
        {
          id: 1,
          state: 'APPROVED',
          commit_id: 'abc1234567890',
          user: { login: 'reviewer' },
        },
      ]);

      const context = createEventContext();
      const config = createConfig();

      const result = await lysbotMerge(octokit, context, config);

      // Should merge successfully
      expect(result.status).toBe('merged');

      // Verify the check icon was used for conventional commits
      const commentCalls = (
        octokit.rest.issues.createComment as MockedFunction<typeof octokit.rest.issues.createComment>
      ).mock.calls;
      const hasConventionalCommitsCheck = commentCalls.some((call) => {
        const body = call[0]?.body;
        return body?.includes('Conventional Commits') && body?.includes(TWEMOJI.CHECK);
      });
      expect(hasConventionalCommitsCheck).toBe(true);
    });
  });

  describe('TOCTOU and mergeability handling', () => {
    it('detects TOCTOU violation when HEAD changes during validation', async () => {
      const octokit = createMockOctokit();
      let callCount = 0;

      // First call returns original HEAD, second call returns different HEAD
      (octokit.rest.pulls.get as MockedFunction<typeof octokit.rest.pulls.get>).mockImplementation(async () => {
        callCount++;
        return {
          data: {
            state: 'open',
            locked: false,
            draft: false,
            merged: false,
            mergeable: true,
            mergeable_state: 'clean',
            head: {
              sha: callCount === 1 ? 'original123' : 'newhead456', // SHA changes on second call
              ref: 'feature/test',
              repo: { fork: false, owner: { id: 1 } },
            },
            base: {
              ref: 'develop',
              repo: { owner: { id: 1 } },
            },
            user: { login: 'testuser' },
            title: 'feat: test pull request',
          },
        } as Awaited<ReturnType<typeof octokit.rest.pulls.get>>;
      });

      // Mock valid approval
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([
        {
          id: 1,
          state: 'APPROVED',
          commit_id: 'original123',
          user: { login: 'reviewer' },
        },
      ]);

      const context = createEventContext();
      const config = createConfig();

      const result = await lysbotMerge(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('TOCTOU');
    });

    it('handles mergeable=null with retry and succeeds', async () => {
      const octokit = createMockOctokit();
      let callCount = 0;

      // First call returns clean state to pass initial checks
      // Subsequent calls during TOCTOU/retry phase simulate null -> true transition
      (octokit.rest.pulls.get as MockedFunction<typeof octokit.rest.pulls.get>).mockImplementation(async () => {
        callCount++;
        // First call: pass initial checks with clean state
        // Later calls (for TOCTOU + retry): transition from null to true
        const isInitialCheck = callCount === 1;
        const isPostRetry = callCount >= 4;
        return {
          data: {
            state: 'open',
            locked: false,
            draft: false,
            merged: false,
            mergeable: isInitialCheck || isPostRetry ? true : null,
            mergeable_state: isInitialCheck || isPostRetry ? 'clean' : 'unknown',
            head: {
              sha: 'abc1234567890',
              ref: 'feature/test',
              repo: { fork: false, owner: { id: 1 } },
            },
            base: {
              ref: 'develop',
              repo: { owner: { id: 1 } },
            },
            user: { login: 'testuser' },
            title: 'feat: test pull request',
          },
        } as Awaited<ReturnType<typeof octokit.rest.pulls.get>>;
      });

      // Mock valid approval
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([
        {
          id: 1,
          state: 'APPROVED',
          commit_id: 'abc1234567890',
          user: { login: 'reviewer' },
        },
      ]);

      const context = createEventContext();
      const config = createConfig({
        mergeableRetryCount: 5,
        mergeableRetryInterval: 0, // No delay in tests
      });

      const result = await lysbotMerge(octokit, context, config);

      expect(result.status).toBe('merged');
    });

    it('fails when mergeable remains null after retries', async () => {
      const octokit = createMockOctokit();
      let callCount = 0;

      // First call returns clean to pass initial checks
      // Subsequent calls return null to test retry failure
      (octokit.rest.pulls.get as MockedFunction<typeof octokit.rest.pulls.get>).mockImplementation(async () => {
        callCount++;
        const isInitialCheck = callCount === 1;
        return {
          data: {
            state: 'open',
            locked: false,
            draft: false,
            merged: false,
            mergeable: isInitialCheck ? true : null,
            mergeable_state: isInitialCheck ? 'clean' : 'unknown',
            head: {
              sha: 'abc1234567890',
              ref: 'feature/test',
              repo: { fork: false, owner: { id: 1 } },
            },
            base: {
              ref: 'develop',
              repo: { owner: { id: 1 } },
            },
            user: { login: 'testuser' },
            title: 'feat: test pull request',
          },
        } as Awaited<ReturnType<typeof octokit.rest.pulls.get>>;
      });

      // Mock valid approval
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([
        {
          id: 1,
          state: 'APPROVED',
          commit_id: 'abc1234567890',
          user: { login: 'reviewer' },
        },
      ]);

      const context = createEventContext();
      const config = createConfig({
        mergeableRetryCount: 2, // Low retry count
        mergeableRetryInterval: 0,
      });

      const result = await lysbotMerge(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('Not mergeable');
    });

    it('fails when PR has dirty mergeable state (conflicts)', async () => {
      const octokit = createMockOctokit();

      (octokit.rest.pulls.get as MockedFunction<typeof octokit.rest.pulls.get>).mockResolvedValue({
        data: {
          state: 'open',
          locked: false,
          draft: false,
          merged: false,
          mergeable: false,
          mergeable_state: 'dirty',
          head: {
            sha: 'abc1234567890',
            ref: 'feature/test',
            repo: { fork: false, owner: { id: 1 } },
          },
          base: {
            ref: 'develop',
            repo: { owner: { id: 1 } },
          },
          user: { login: 'testuser' },
          title: 'feat: test pull request',
        },
      } as unknown as Awaited<ReturnType<typeof octokit.rest.pulls.get>>);

      // Mock valid approval
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([
        {
          id: 1,
          state: 'APPROVED',
          commit_id: 'abc1234567890',
          user: { login: 'reviewer' },
        },
      ]);

      const context = createEventContext();
      const config = createConfig();

      const result = await lysbotMerge(octokit, context, config);

      expect(result.status).toBe('failed');
    });

    it('handles merge API failure', async () => {
      const octokit = createMockOctokit();

      // Mock valid approval
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([
        {
          id: 1,
          state: 'APPROVED',
          commit_id: 'abc1234567890',
          user: { login: 'reviewer' },
        },
      ]);

      // Mock merge to fail
      (octokit.rest.pulls.merge as MockedFunction<typeof octokit.rest.pulls.merge>).mockRejectedValue(
        new Error('Merge conflict'),
      );

      const context = createEventContext();
      const config = createConfig();

      const result = await lysbotMerge(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('Merge failed');
    });
  });
});
