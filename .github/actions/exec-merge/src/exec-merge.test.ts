/**
 * exec-merge.test.ts - Unit tests for exec-merge action
 * 
 * Tests cover all pure logic functions and validate the core business rules.
 * GitHub API interactions are mocked for isolation.
 */

import { describe, it, expect, vi, beforeEach, type MockedFunction } from 'vitest';
import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import {
  isExecMergeCommand,
  isBot,
  hasValidAuthorAssociation,
  hasValidPermission,
  determineMergeMethod,
  validatePRState,
  getMergeableStateDescription,
  buildCheckResultsMarkdown,
  TWEMOJI,
  COMMAND_REGEX,
  type ExecMergeConfig,
  type PullRequestData,
  type CheckResult,
  type Octokit,
  addReaction,
  postComment,
  getCollaboratorPermission,
  fetchPullRequestData,
  dismissReview,
  countUnresolvedThreads,
  mergePullRequest,
  execMerge,
  type EventContext,
} from './exec-merge';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Creates a default config for tests.
 */
function createConfig(overrides: Partial<ExecMergeConfig> = {}): ExecMergeConfig {
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
          },
        }),
        listReviews: vi.fn().mockResolvedValue({ data: [] }),
        dismissReview: vi.fn().mockResolvedValue({}),
        merge: vi.fn().mockResolvedValue({}),
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
    commentBody: '/exec merge',
    actor: 'testactor',
    userType: 'User',
    authorAssociation: 'MEMBER',
    serverUrl: 'https://github.com',
    runId: 12345,
    ...overrides,
  };
}

// =============================================================================
// Tests for isExecMergeCommand
// Specification: Only exact "/exec merge" command triggers merge (case-sensitive)
// =============================================================================

describe('isExecMergeCommand', () => {
  it('matches exact "/exec merge" command', () => {
    expect(isExecMergeCommand('/exec merge')).toBe(true);
  });

  it('matches with leading whitespace (space/tab/newline)', () => {
    expect(isExecMergeCommand('  /exec merge')).toBe(true);
    expect(isExecMergeCommand('\t/exec merge')).toBe(true);
    expect(isExecMergeCommand('\n/exec merge')).toBe(true);
  });

  it('matches with trailing whitespace (space/tab/newline)', () => {
    expect(isExecMergeCommand('/exec merge  ')).toBe(true);
    expect(isExecMergeCommand('/exec merge\t')).toBe(true);
    expect(isExecMergeCommand('/exec merge\n')).toBe(true);
  });

  it('matches with multiple spaces between words', () => {
    expect(isExecMergeCommand('/exec  merge')).toBe(true);
    expect(isExecMergeCommand('/exec   merge')).toBe(true);
    expect(isExecMergeCommand('/exec\tmerge')).toBe(true);
  });

  it('rejects command with extra arguments (no flags allowed)', () => {
    expect(isExecMergeCommand('/exec merge now')).toBe(false);
    expect(isExecMergeCommand('/exec merge --force')).toBe(false);
  });

  it('rejects partial or malformed commands', () => {
    expect(isExecMergeCommand('/exec')).toBe(false);
    expect(isExecMergeCommand('/exec merg')).toBe(false);
    expect(isExecMergeCommand('exec merge')).toBe(false);
  });

  it('rejects when command is embedded in other text', () => {
    expect(isExecMergeCommand('Please /exec merge this')).toBe(false);
    expect(isExecMergeCommand('Run /exec merge')).toBe(false);
  });

  it('is case-sensitive (uppercase rejected)', () => {
    expect(isExecMergeCommand('/EXEC MERGE')).toBe(false);
    expect(isExecMergeCommand('/Exec Merge')).toBe(false);
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
// Specification: Only OWNER/MEMBER/COLLABORATOR can use /exec merge
// =============================================================================

describe('hasValidAuthorAssociation', () => {
  it('allows OWNER (repository/org owner)', () => {
    expect(hasValidAuthorAssociation('OWNER')).toBe(true);
  });

  it('allows MEMBER (organization member)', () => {
    expect(hasValidAuthorAssociation('MEMBER')).toBe(true);
  });

  it('allows COLLABORATOR (explicit repo access)', () => {
    expect(hasValidAuthorAssociation('COLLABORATOR')).toBe(true);
  });

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

// =============================================================================
// Tests for hasValidPermission
// Specification: admin/maintain/write permissions required for merge
// =============================================================================

describe('hasValidPermission', () => {
  it('allows admin permission', () => {
    expect(hasValidPermission('admin')).toBe(true);
  });

  it('allows maintain permission', () => {
    expect(hasValidPermission('maintain')).toBe(true);
  });

  it('allows write permission', () => {
    expect(hasValidPermission('write')).toBe(true);
  });

  it('rejects read permission', () => {
    expect(hasValidPermission('read')).toBe(false);
  });

  it('rejects none (no permission)', () => {
    expect(hasValidPermission('none')).toBe(false);
  });
});

// =============================================================================
// Tests for determineMergeMethod
// Specification: Merge method is determined by branch naming patterns
// - Head branch patterns take precedence over base branch patterns
// - release/* and fix/sync/* heads use merge commit (preserve history)
// - develop base uses squash (clean feature commits)
// - Default is merge commit
// =============================================================================

describe('determineMergeMethod', () => {
  const config = createConfig();

  // Head branch patterns (highest precedence)
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

  // Base branch patterns
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

  // Default case
  it('uses merge commit by default for unmatched branch patterns', () => {
    const result = determineMergeMethod('feature/test', 'main', config);
    expect(result.method).toBe('merge');
    expect(result.reason).toContain('Default merge commit');
  });

  // Precedence rule
  it('head branch pattern takes precedence over base (release/* to develop uses merge)', () => {
    const result = determineMergeMethod('release/1.0.0', 'develop', config);
    expect(result.method).toBe('merge');
  });
});

// =============================================================================
// Tests for validatePRState
// Specification: PR must be open, unlocked, and not a draft
// =============================================================================

describe('validatePRState', () => {
  it('passes all checks for valid open PR', () => {
    const prData = createPRData();
    const checks = validatePRState(prData);

    expect(checks).toHaveLength(3);
    expect(checks.every((c) => c.passed)).toBe(true);
  });

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
    const checks: CheckResult[] = [
      { name: 'Test check', passed: false, details: 'reason' },
    ];
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
});

// =============================================================================
// Tests for COMMAND_REGEX constant
// =============================================================================

describe('COMMAND_REGEX', () => {
  it('should be a valid regex pattern', () => {
    expect(COMMAND_REGEX).toBeInstanceOf(RegExp);
  });

  it('should match the same patterns as isExecMergeCommand', () => {
    const testCases = [
      { input: '/exec merge', expected: true },
      { input: '  /exec merge', expected: true },
      { input: '/exec merge  ', expected: true },
      { input: '/exec  merge', expected: true },
      { input: '/exec merge now', expected: false },
      { input: 'run /exec merge', expected: false },
    ];

    for (const { input, expected } of testCases) {
      expect(COMMAND_REGEX.test(input)).toBe(expected);
    }
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
    (octokit.rest.reactions.createForIssueComment as MockedFunction<typeof octokit.rest.reactions.createForIssueComment>).mockRejectedValue(
      new Error('Already exists')
    );

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
    (octokit.rest.repos.getCollaboratorPermissionLevel as MockedFunction<typeof octokit.rest.repos.getCollaboratorPermissionLevel>).mockRejectedValue(
      new Error('Not found')
    );

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
      new Error('Forbidden')
    );

    const result = await dismissReview(octokit, 'owner', 'repo', 1, 123, 'Stale');
    expect(result).toBe(false);
  });
});

describe('countUnresolvedThreads', () => {
  it('should count unresolved threads across pages', async () => {
    const octokit = createMockOctokit();
    let callCount = 0;
    (octokit.graphql as MockedFunction<typeof octokit.graphql>).mockImplementation(async () => {
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
    const result = await mergePullRequest(
      octokit,
      'owner',
      'repo',
      1,
      'squash',
      'abc123',
      'Merge message'
    );

    expect(result.success).toBe(true);
  });

  it('should return error message on failure', async () => {
    const octokit = createMockOctokit();
    (octokit.rest.pulls.merge as MockedFunction<typeof octokit.rest.pulls.merge>).mockRejectedValue(
      new Error('Merge conflict')
    );

    const result = await mergePullRequest(
      octokit,
      'owner',
      'repo',
      1,
      'squash',
      'abc123',
      'Merge message'
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Merge conflict');
  });
});

// =============================================================================
// Tests for execMerge main function
// Specification: End-to-end merge workflow behavior
// =============================================================================

describe('execMerge', () => {
  it('skips processing for bot comments', async () => {
    const octokit = createMockOctokit();
    const context = createEventContext({ userType: 'Bot' });
    const config = createConfig();

    const result = await execMerge(octokit, context, config);

    expect(result.status).toBe('skipped');
    expect(result.message).toContain('bot');
  });

  it('skips processing for non-matching command', async () => {
    const octokit = createMockOctokit();
    const context = createEventContext({ commentBody: 'Hello world' });
    const config = createConfig();

    const result = await execMerge(octokit, context, config);

    expect(result.status).toBe('skipped');
    expect(result.message).toContain('not matched');
  });

  it('fails for users without valid author association', async () => {
    const octokit = createMockOctokit();
    const context = createEventContext({ authorAssociation: 'NONE' });
    const config = createConfig();

    const result = await execMerge(octokit, context, config);

    expect(result.status).toBe('failed');
    expect(result.message).toContain('author association');
  });

  it('fails for users without write permission', async () => {
    const octokit = createMockOctokit();
    (octokit.rest.repos.getCollaboratorPermissionLevel as MockedFunction<typeof octokit.rest.repos.getCollaboratorPermissionLevel>).mockResolvedValue({
      data: { permission: 'read' },
    } as Awaited<ReturnType<typeof octokit.rest.repos.getCollaboratorPermissionLevel>>);
    const context = createEventContext();
    const config = createConfig();

    const result = await execMerge(octokit, context, config);

    expect(result.status).toBe('failed');
    expect(result.message).toContain('permissions');
  });

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
      },
    } as unknown as Awaited<ReturnType<typeof octokit.rest.pulls.get>>);
    const context = createEventContext();
    const config = createConfig();

    const result = await execMerge(octokit, context, config);

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
      },
    } as unknown as Awaited<ReturnType<typeof octokit.rest.pulls.get>>);
    const context = createEventContext();
    const config = createConfig();

    const result = await execMerge(octokit, context, config);

    expect(result.status).toBe('already_merged');
  });

  it('successfully merges PR with valid approval (uses squash for develop base)', async () => {
    const octokit = createMockOctokit();

    // Mock approved review from another user
    (octokit.paginate as MockedFunction<typeof octokit.paginate>).mockResolvedValue([
      {
        id: 1,
        state: 'APPROVED',
        commit_id: 'abc1234567890',
        user: { login: 'reviewer' },
      },
    ]);

    const context = createEventContext();
    const config = createConfig();

    const result = await execMerge(octokit, context, config);

    expect(result.status).toBe('merged');
    expect(result.mergeMethod).toBe('squash'); // base is develop
  });

  it('fails when no valid approvals exist', async () => {
    const octokit = createMockOctokit();

    // No approved reviews
    (octokit.paginate as MockedFunction<typeof octokit.paginate>).mockResolvedValue([]);

    const context = createEventContext();
    const config = createConfig();

    const result = await execMerge(octokit, context, config);

    expect(result.status).toBe('failed');
    expect(result.message).toContain('checks failed');
  });
});
