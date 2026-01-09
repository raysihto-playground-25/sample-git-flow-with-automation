/**
 * __tests__/modules/lysbot-merge/mod.test.ts - Tests for lysbot-merge module
 *
 * This file contains comprehensive tests for the lysbot-merge module,
 * including port-specific fakes.
 */

import * as core from '@actions/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock @actions/core and @actions/github BEFORE importing anything else
vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
  setOutput: vi.fn(),
  info: vi.fn(),
  summary: {
    addRaw: vi.fn().mockReturnThis(),
    write: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@actions/github', () => ({
  context: {
    repo: { owner: 'test-owner', repo: 'test-repo' },
    actor: 'test-actor',
    runId: 12345,
    eventName: 'issue_comment',
    payload: {
      issue: {
        number: 123,
        pull_request: {},
      },
      comment: {
        id: 999,
        body: '/lysbot merge',
        user: { type: 'User' },
        author_association: 'MEMBER',
      },
    },
  },
}));

import type { GitHubPort } from '../../../src/modules/lysbot-merge/mod.js';
import {
  parseCommand,
  isBot,
  hasValidAuthorAssociation,
  hasValidPermission,
  determineMergeMethod,
  validatePRState,
  getMergeableStateDescription,
  buildCheckResultsMarkdown,
  isConventionalCommitTitle,
  buildSummaryMarkdown,
  executeMerge,
  readActionInputs,
  buildEventContext,
  writeActionOutputs,
  writeActionSummary,
  GitHubAdapter,
  type MergeConfig,
  type EventContext,
  type PullRequestData,
  type CheckResult,
  type ActionResult,
} from '../../../src/modules/lysbot-merge/mod.js';

// ============================================================================
// Port-specific fakes (remain in this test file)
// ============================================================================

/**
 * Fake GitHub Port implementation for testing.
 */
class FakeGitHubPort implements GitHubPort {
  public reactions: Array<{ commentId: number; reaction: string }> = [];
  public comments: Array<{ prNumber: number; body: string }> = [];
  public permissions: Map<string, string> = new Map();
  public prData: Map<number, PullRequestData> = new Map();
  public reviews: Map<number, Array<{ id: number; user: { login: string } | null; commit_id: string | null }>> =
    new Map();
  public dismissedReviews: Array<{ prNumber: number; reviewId: number; message: string }> = [];
  public unresolvedThreadCounts: Map<number, number> = new Map();
  public commits: Map<
    number,
    Array<{ commit: { message: string; author?: { name?: string; email?: string } | null } }>
  > = new Map();
  public mergeResults: Map<number, { success: boolean; error?: string; mergeCommitSha?: string }> = new Map();

  async addReaction(commentId: number, reaction: string): Promise<void> {
    this.reactions.push({ commentId, reaction });
  }

  async postComment(prNumber: number, body: string): Promise<void> {
    this.comments.push({ prNumber, body });
  }

  async getCollaboratorPermission(username: string): Promise<string> {
    return this.permissions.get(username) ?? 'none';
  }

  async fetchPullRequestData(prNumber: number): Promise<PullRequestData> {
    const data = this.prData.get(prNumber);
    if (!data) {
      throw new Error(`PR ${prNumber} not found in fake data`);
    }
    return data;
  }

  async fetchApprovedReviews(
    prNumber: number,
  ): Promise<Array<{ id: number; user: { login: string } | null; commit_id: string | null }>> {
    return this.reviews.get(prNumber) ?? [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async dismissReview(_prNumber: number, _reviewId: number, _message: string): Promise<boolean> {
    return true;
  }

  async countUnresolvedThreads(prNumber: number): Promise<number> {
    return this.unresolvedThreadCounts.get(prNumber) ?? 0;
  }

  async fetchPullRequestCommits(
    prNumber: number,
  ): Promise<Array<{ commit: { message: string; author?: { name?: string; email?: string } | null } }>> {
    return this.commits.get(prNumber) ?? [];
  }

  async mergePullRequest(
    prNumber: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _method: 'squash' | 'merge',
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _sha: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _commitTitle: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _commitMessage: string,
  ): Promise<{ success: boolean; error?: string; mergeCommitSha?: string }> {
    return this.mergeResults.get(prNumber) ?? { success: true, mergeCommitSha: 'abc123' };
  }
}

// ============================================================================
// Domain function tests
// ============================================================================

describe('Domain: parseCommand', () => {
  it('should parse basic merge command', () => {
    const result = parseCommand('/lysbot merge');
    expect(result).toEqual({ overrideApprovalRequirement: false });
  });

  it('should parse merge command with override flag', () => {
    const result = parseCommand('/lysbot merge --override-approval-requirement');
    expect(result).toEqual({ overrideApprovalRequirement: true });
  });

  it('should return null for non-command', () => {
    const result = parseCommand('hello world');
    expect(result).toBeNull();
  });

  it('should return null for invalid flag', () => {
    const result = parseCommand('/lysbot merge --invalid-flag');
    expect(result).toBeNull();
  });
});

describe('Domain: isBot', () => {
  it('should return true for Bot type', () => {
    expect(isBot('Bot')).toBe(true);
  });

  it('should return false for User type', () => {
    expect(isBot('User')).toBe(false);
  });
});

describe('Domain: hasValidAuthorAssociation', () => {
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
});

describe('Domain: hasValidPermission', () => {
  it('should return true for admin', () => {
    expect(hasValidPermission('admin')).toBe(true);
  });

  it('should return true for write', () => {
    expect(hasValidPermission('write')).toBe(true);
  });

  it('should return false for read', () => {
    expect(hasValidPermission('read')).toBe(false);
  });
});

describe('Domain: determineMergeMethod', () => {
  const config: MergeConfig = {
    releaseBranchPrefix: 'release/',
    developBranch: 'develop',
    syncBranchPrefix: 'fix/sync/',
    mergeableRetryCount: 5,
    mergeableRetryInterval: 10,
  };

  it('should use merge for release branch head', () => {
    const result = determineMergeMethod('release/1.0', 'main', config);
    expect(result.method).toBe('merge');
    expect(result.reason).toContain('release branch');
  });

  it('should use merge for sync branch head', () => {
    const result = determineMergeMethod('fix/sync/main-to-develop', 'develop', config);
    expect(result.method).toBe('merge');
    expect(result.reason).toContain('sync branch');
  });

  it('should use squash for release branch base', () => {
    const result = determineMergeMethod('feature/test', 'release/1.0', config);
    expect(result.method).toBe('squash');
  });

  it('should use squash for develop branch base', () => {
    const result = determineMergeMethod('feature/test', 'develop', config);
    expect(result.method).toBe('squash');
  });

  it('should use merge as default', () => {
    const result = determineMergeMethod('feature/test', 'main', config);
    expect(result.method).toBe('merge');
  });
});

describe('Domain: validatePRState', () => {
  it('should pass for open, unlocked, non-draft PR', () => {
    const prData: PullRequestData = {
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
    };
    const checks = validatePRState(prData);
    expect(checks[0]?.passed).toBe(true);
  });

  it('should fail for closed PR', () => {
    const prData: PullRequestData = {
      state: 'closed',
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
    };
    const checks = validatePRState(prData);
    expect(checks[0]?.passed).toBe(false);
    expect(checks[0]?.details).toContain('closed');
  });

  it('should fail for locked PR', () => {
    const prData: PullRequestData = {
      state: 'open',
      locked: true,
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
    };
    const checks = validatePRState(prData);
    expect(checks[0]?.passed).toBe(false);
    expect(checks[0]?.details).toContain('locked');
  });

  it('should fail for draft PR', () => {
    const prData: PullRequestData = {
      state: 'open',
      locked: false,
      draft: true,
      merged: false,
      mergeable: true,
      mergeableState: 'clean',
      headSha: 'abc123',
      headRef: 'feature/test',
      baseRef: 'main',
      author: 'testuser',
      isFork: false,
      title: 'Test PR',
    };
    const checks = validatePRState(prData);
    expect(checks[0]?.passed).toBe(false);
    expect(checks[0]?.details).toContain('draft');
  });
});

describe('Domain: getMergeableStateDescription', () => {
  it('should return description for dirty state', () => {
    expect(getMergeableStateDescription('dirty')).toBe('has unresolved conflicts');
  });

  it('should return description for clean state', () => {
    expect(getMergeableStateDescription('clean')).toBe('ready to merge');
  });

  it('should return description for unknown state', () => {
    expect(getMergeableStateDescription('unknown_state')).toContain('mergeable_state: unknown_state');
  });
});

describe('Domain: buildCheckResultsMarkdown', () => {
  it('should format passed check', () => {
    const checks: CheckResult[] = [{ name: 'Test check', passed: true }];
    const result = buildCheckResultsMarkdown(checks);
    expect(result).toContain('Test check');
  });

  it('should format failed check', () => {
    const checks: CheckResult[] = [{ name: 'Test check', passed: false, details: 'failed' }];
    const result = buildCheckResultsMarkdown(checks);
    expect(result).toContain('Test check');
    expect(result).toContain('failed');
  });

  it('should format optional check with warning', () => {
    const checks: CheckResult[] = [{ name: 'Optional check', passed: false, optional: true }];
    const result = buildCheckResultsMarkdown(checks);
    expect(result).toContain('Optional check');
  });
});

describe('Domain: isConventionalCommitTitle', () => {
  it('should return true for valid conventional commit', () => {
    expect(isConventionalCommitTitle('feat: add new feature')).toBe(true);
    expect(isConventionalCommitTitle('fix(auth): resolve login issue')).toBe(true);
  });

  it('should return false for invalid format', () => {
    expect(isConventionalCommitTitle('Update README')).toBe(false);
  });
});

describe('Domain: buildSummaryMarkdown', () => {
  it('should build summary markdown', () => {
    const result = buildSummaryMarkdown('✅ Success', 123, 'testuser', 'squash');
    expect(result).toContain('lysbot-merge Summary');
    expect(result).toContain('#123');
    expect(result).toContain('@testuser');
    expect(result).toContain('squash');
  });

  it('should build summary markdown without merge method', () => {
    const result = buildSummaryMarkdown('⏭️ Skipped', 456, 'anotheruser');
    expect(result).toContain('lysbot-merge Summary');
    expect(result).toContain('#456');
    expect(result).toContain('@anotheruser');
    expect(result).not.toContain('Merge Method');
  });
});

// ============================================================================
// Action layer tests
// ============================================================================

describe('Action: readActionInputs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should read inputs with default values', () => {
    vi.mocked(core.getInput).mockReturnValue('');
    const config = readActionInputs();
    expect(config).toEqual({
      releaseBranchPrefix: 'release/',
      developBranch: 'develop',
      syncBranchPrefix: 'fix/sync/',
      mergeableRetryCount: 5,
      mergeableRetryInterval: 10,
    });
  });

  it('should read custom input values', () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      const values: Record<string, string> = {
        release_branch_prefix: 'rel/',
        develop_branch: 'main',
        sync_branch_prefix: 'sync/',
        mergeable_retry_count: '3',
        mergeable_retry_interval: '5',
      };
      return values[name] || '';
    });

    const config = readActionInputs();
    expect(config).toEqual({
      releaseBranchPrefix: 'rel/',
      developBranch: 'main',
      syncBranchPrefix: 'sync/',
      mergeableRetryCount: 3,
      mergeableRetryInterval: 5,
    });
  });
});

describe('Action: buildEventContext', () => {
  it('should build event context from GitHub context', () => {
    const context = buildEventContext();
    expect(context.owner).toBe('test-owner');
    expect(context.repo).toBe('test-repo');
    expect(context.prNumber).toBe(123);
    expect(context.actor).toBe('test-actor');
  });
});

describe('Action: writeActionOutputs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should write outputs for merged result', () => {
    const result: ActionResult = { status: 'merged', message: 'Success', mergeMethod: 'squash' };
    writeActionOutputs(result);
    expect(core.setOutput).toHaveBeenCalledWith('result', 'merged');
    expect(core.setOutput).toHaveBeenCalledWith('merge_method', 'squash');
  });

  it('should write outputs without merge method for skipped result', () => {
    const result: ActionResult = { status: 'skipped', message: 'Skipped' };
    writeActionOutputs(result);
    expect(core.setOutput).toHaveBeenCalledWith('result', 'skipped');
    expect(core.setOutput).not.toHaveBeenCalledWith('merge_method', expect.anything());
  });
});

describe('Action: writeActionSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should write summary for merged result', async () => {
    const result: ActionResult = { status: 'merged', message: 'Success', mergeMethod: 'squash' };
    await writeActionSummary(result, 123, 'testuser');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(core.summary.addRaw).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(core.summary.write).toHaveBeenCalled();
  });

  it('should write summary for skipped result', async () => {
    const result: ActionResult = { status: 'skipped', message: 'Skipped' };
    await writeActionSummary(result, 456, 'anotheruser');
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(core.summary.addRaw).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(core.summary.write).toHaveBeenCalled();
  });
});

// ============================================================================
// Infra layer tests (GitHubAdapter)
// ============================================================================

/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
describe('Infra: GitHubAdapter', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockOctokit: any;
  let adapter: GitHubAdapter;

  beforeEach(() => {
    mockOctokit = {
      rest: {
        reactions: {
          createForIssueComment: vi.fn().mockResolvedValue({}),
        },
        issues: {
          createComment: vi.fn().mockResolvedValue({}),
        },
        repos: {
          getCollaboratorPermissionLevel: vi.fn().mockResolvedValue({ data: { permission: 'write' } }),
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
              head: { sha: 'abc123', ref: 'feature/test', repo: { fork: false, owner: { id: 1 } } },
              base: { ref: 'main', repo: { owner: { id: 1 } } },
              user: { login: 'testuser' },
              title: 'Test PR',
            },
          }),
          listReviews: vi.fn(),
          dismissReview: vi.fn().mockResolvedValue({}),
          listCommits: vi.fn(),
          merge: vi.fn().mockResolvedValue({ data: { sha: 'merge123' } }),
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
    };
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    adapter = new GitHubAdapter(mockOctokit, 'test-owner', 'test-repo');
  });

  it('should add reaction successfully', async () => {
    await adapter.addReaction(999, 'eyes');
    expect(mockOctokit.rest.reactions.createForIssueComment).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      comment_id: 999,
      content: 'eyes',
    });
  });

  it('should handle reaction errors silently', async () => {
    mockOctokit.rest.reactions.createForIssueComment.mockRejectedValue(new Error('Already reacted'));
    await expect(adapter.addReaction(999, 'eyes')).resolves.not.toThrow();
  });

  it('should post comment', async () => {
    await adapter.postComment(123, 'Test comment');
    expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
      owner: 'test-owner',
      repo: 'test-repo',
      issue_number: 123,
      body: 'Test comment',
    });
  });

  it('should get collaborator permission', async () => {
    const permission = await adapter.getCollaboratorPermission('testuser');
    expect(permission).toBe('write');
  });

  it('should return none for permission errors', async () => {
    mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockRejectedValue(new Error('Not found'));
    const permission = await adapter.getCollaboratorPermission('unknownuser');
    expect(permission).toBe('none');
  });

  it('should fetch pull request data', async () => {
    const prData = await adapter.fetchPullRequestData(123);
    expect(prData.state).toBe('open');
    expect(prData.headSha).toBe('abc123');
  });

  it('should fetch approved reviews', async () => {
    mockOctokit.paginate.mockResolvedValue([
      { id: 1, state: 'APPROVED', user: { login: 'reviewer' }, commit_id: 'abc123' },
    ]);
    const reviews = await adapter.fetchApprovedReviews(123);
    expect(reviews).toHaveLength(1);
    expect(reviews[0]?.user?.login).toBe('reviewer');
  });

  it('should dismiss review successfully', async () => {
    const result = await adapter.dismissReview(123, 1, 'Stale approval');
    expect(result).toBe(true);
  });

  it('should handle dismiss review errors', async () => {
    mockOctokit.rest.pulls.dismissReview.mockRejectedValue(new Error('Insufficient permissions'));
    const result = await adapter.dismissReview(123, 1, 'Stale approval');
    expect(result).toBe(false);
  });

  it('should count unresolved threads', async () => {
    mockOctokit.graphql.mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [{ isResolved: false }, { isResolved: true }],
          },
        },
      },
    });
    const count = await adapter.countUnresolvedThreads(123);
    expect(count).toBe(1);
  });

  it('should fetch pull request commits', async () => {
    mockOctokit.paginate.mockResolvedValue([
      { commit: { message: 'Initial commit', author: { name: 'Test', email: 'test@example.com' } } },
    ]);
    const commits = await adapter.fetchPullRequestCommits(123);
    expect(commits).toHaveLength(1);
  });

  it('should merge pull request successfully', async () => {
    const result = await adapter.mergePullRequest(123, 'squash', 'abc123', 'Test PR (#123)', 'Body');
    expect(result.success).toBe(true);
    expect(result.mergeCommitSha).toBe('merge123');
  });

  it('should handle merge errors', async () => {
    mockOctokit.rest.pulls.merge.mockRejectedValue(new Error('Merge conflict'));
    const result = await adapter.mergePullRequest(123, 'squash', 'abc123', 'Test PR (#123)', 'Body');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Merge conflict');
  });
});

// ============================================================================
// App orchestration tests
// ============================================================================

describe('App: executeMerge', () => {
  let fakePort: FakeGitHubPort;
  let context: EventContext;
  let config: MergeConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    fakePort = new FakeGitHubPort();
    context = {
      owner: 'test-owner',
      repo: 'test-repo',
      prNumber: 123,
      commentId: 999,
      commentBody: '/lysbot merge',
      actor: 'testuser',
      userType: 'User',
      authorAssociation: 'MEMBER',
      serverUrl: 'https://github.com',
      runId: 12345,
      eventName: 'issue_comment',
      isPullRequest: true,
    };
    config = {
      releaseBranchPrefix: 'release/',
      developBranch: 'develop',
      syncBranchPrefix: 'fix/sync/',
      mergeableRetryCount: 5,
      mergeableRetryInterval: 10,
    };
  });

  it('should skip for non-issue_comment event', async () => {
    context.eventName = 'push';
    const result = await executeMerge(fakePort, context, config);
    expect(result.status).toBe('skipped');
    expect(result.message).toContain('issue_comment');
  });

  it('should skip for non-PR comment', async () => {
    context.isPullRequest = false;
    const result = await executeMerge(fakePort, context, config);
    expect(result.status).toBe('skipped');
    expect(result.message).toContain('not on a PR');
  });

  it('should skip for bot comment', async () => {
    context.userType = 'Bot';
    const result = await executeMerge(fakePort, context, config);
    expect(result.status).toBe('skipped');
    expect(result.message).toContain('bot');
  });

  it('should skip for invalid command', async () => {
    context.commentBody = 'hello world';
    const result = await executeMerge(fakePort, context, config);
    expect(result.status).toBe('skipped');
    expect(result.message).toContain('Command not matched');
  });

  it('should fail for invalid author association', async () => {
    context.authorAssociation = 'CONTRIBUTOR';
    fakePort.permissions.set('testuser', 'write');
    const result = await executeMerge(fakePort, context, config);
    expect(result.status).toBe('failed');
    expect(result.message).toContain('Invalid author association');
    expect(fakePort.comments.length).toBeGreaterThan(0);
  });

  it('should fail for insufficient permissions', async () => {
    fakePort.permissions.set('testuser', 'read');
    const result = await executeMerge(fakePort, context, config);
    expect(result.status).toBe('failed');
    expect(result.message).toContain('Insufficient permissions');
  });

  it('should handle fork PR', async () => {
    fakePort.permissions.set('testuser', 'write');
    fakePort.prData.set(123, {
      state: 'open',
      locked: false,
      draft: false,
      merged: false,
      mergeable: true,
      mergeableState: 'clean',
      headSha: 'abc123',
      headRef: 'feature/test',
      baseRef: 'main',
      author: 'otheruser',
      isFork: true,
      title: 'Test PR',
    });

    const result = await executeMerge(fakePort, context, config);
    expect(result.status).toBe('failed');
    expect(result.message).toContain('Fork PR not supported');
  });

  it('should handle already merged PR', async () => {
    fakePort.permissions.set('testuser', 'write');
    fakePort.prData.set(123, {
      state: 'closed',
      locked: false,
      draft: false,
      merged: true,
      mergeable: false,
      mergeableState: 'clean',
      headSha: 'abc123',
      headRef: 'feature/test',
      baseRef: 'main',
      author: 'testuser',
      isFork: false,
      title: 'Test PR',
    });

    const result = await executeMerge(fakePort, context, config);
    expect(result.status).toBe('already_merged');
  });

  it('should fail when checks do not pass', async () => {
    fakePort.permissions.set('testuser', 'write');
    fakePort.prData.set(123, {
      state: 'closed', // This will fail the check
      locked: false,
      draft: false,
      merged: false,
      mergeable: true,
      mergeableState: 'clean',
      headSha: 'abc123',
      headRef: 'feature/test',
      baseRef: 'main',
      author: 'otheruser',
      isFork: false,
      title: 'feat: test PR',
    });
    fakePort.unresolvedThreadCounts.set(123, 0);
    fakePort.reviews.set(123, []);

    const result = await executeMerge(fakePort, context, config);
    expect(result.status).toBe('failed');
    expect(result.message).toContain('Merge checks failed');
  });

  it('should successfully merge when all checks pass', async () => {
    fakePort.permissions.set('testuser', 'write');
    fakePort.prData.set(123, {
      state: 'open',
      locked: false,
      draft: false,
      merged: false,
      mergeable: true,
      mergeableState: 'clean',
      headSha: 'abc123',
      headRef: 'feature/test',
      baseRef: 'develop',
      author: 'otheruser',
      isFork: false,
      title: 'feat: test PR',
    });
    fakePort.unresolvedThreadCounts.set(123, 0);
    fakePort.reviews.set(123, [
      {
        id: 1,
        user: { login: 'reviewer' },
        commit_id: 'abc123',
      },
    ]);
    fakePort.commits.set(123, [
      {
        commit: {
          message: 'feat: initial commit',
          author: { name: 'Test Author', email: 'test@example.com' },
        },
      },
    ]);
    fakePort.mergeResults.set(123, { success: true, mergeCommitSha: 'merge123' });

    const result = await executeMerge(fakePort, context, config);
    expect(result.status).toBe('merged');
    expect(result.mergeMethod).toBe('squash');
  });

  it('should handle merge with release branch as head (use merge commit)', async () => {
    fakePort.permissions.set('testuser', 'write');
    fakePort.prData.set(123, {
      state: 'open',
      locked: false,
      draft: false,
      merged: false,
      mergeable: true,
      mergeableState: 'clean',
      headSha: 'abc123',
      headRef: 'release/1.0',
      baseRef: 'main',
      author: 'otheruser',
      isFork: false,
      title: 'feat: release PR',
    });
    fakePort.unresolvedThreadCounts.set(123, 0);
    fakePort.reviews.set(123, [
      {
        id: 1,
        user: { login: 'reviewer' },
        commit_id: 'abc123',
      },
    ]);
    fakePort.commits.set(123, []);
    fakePort.mergeResults.set(123, { success: true, mergeCommitSha: 'merge456' });

    const result = await executeMerge(fakePort, context, config);
    expect(result.status).toBe('merged');
    expect(result.mergeMethod).toBe('merge');
  });

  it('should handle merge failure', async () => {
    fakePort.permissions.set('testuser', 'write');
    fakePort.prData.set(123, {
      state: 'open',
      locked: false,
      draft: false,
      merged: false,
      mergeable: true,
      mergeableState: 'clean',
      headSha: 'abc123',
      headRef: 'feature/test',
      baseRef: 'develop',
      author: 'otheruser',
      isFork: false,
      title: 'feat: test PR',
    });
    fakePort.unresolvedThreadCounts.set(123, 0);
    fakePort.reviews.set(123, [
      {
        id: 1,
        user: { login: 'reviewer' },
        commit_id: 'abc123',
      },
    ]);
    fakePort.commits.set(123, []);
    fakePort.mergeResults.set(123, { success: false, error: 'Merge conflict' });

    const result = await executeMerge(fakePort, context, config);
    expect(result.status).toBe('failed');
    expect(result.message).toContain('Merge failed');
  });

  it('should handle TOCTOU violation', async () => {
    fakePort.permissions.set('testuser', 'write');

    // First call returns original SHA
    let callCount = 0;
    fakePort.fetchPullRequestData = async () => {
      callCount++;
      return {
        state: 'open',
        locked: false,
        draft: false,
        merged: false,
        mergeable: true,
        mergeableState: 'clean',
        headSha: callCount === 1 ? 'abc123' : 'def456', // SHA changes on second call
        headRef: 'feature/test',
        baseRef: 'develop',
        author: 'otheruser',
        isFork: false,
        title: 'feat: test PR',
      };
    };
    fakePort.unresolvedThreadCounts.set(123, 0);
    fakePort.reviews.set(123, [
      {
        id: 1,
        user: { login: 'reviewer' },
        commit_id: 'abc123',
      },
    ]);

    const result = await executeMerge(fakePort, context, config);
    expect(result.status).toBe('failed');
    expect(result.message).toContain('TOCTOU violation');
  });

  it('should handle not mergeable state', async () => {
    fakePort.permissions.set('testuser', 'write');

    // First call returns valid state, second call returns not mergeable
    let callCount = 0;
    fakePort.fetchPullRequestData = async () => {
      callCount++;
      return {
        state: 'open',
        locked: false,
        draft: false,
        merged: false,
        mergeable: callCount === 1 ? true : false, // First check passes, then fails
        mergeableState: callCount === 1 ? 'clean' : 'dirty',
        headSha: 'abc123',
        headRef: 'feature/test',
        baseRef: 'develop',
        author: 'otheruser',
        isFork: false,
        title: 'feat: test PR',
      };
    };
    fakePort.unresolvedThreadCounts.set(123, 0);
    fakePort.reviews.set(123, [
      {
        id: 1,
        user: { login: 'reviewer' },
        commit_id: 'abc123',
      },
    ]);

    const result = await executeMerge(fakePort, context, config);
    expect(result.status).toBe('failed');
    expect(result.message).toContain('Not mergeable');
  });
});
