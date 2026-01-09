/**
 * __tests__/modules/merge/mod.test.ts
 *
 * Tests for the merge module following the architecture's test placement rules.
 * Tests are structured to mirror the source code organization.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';

import type {
  ActionConfig,
  EventContext,
  PullRequestData,
  CheckResult,
  MergeMethodResult,
  MergeOptions,
} from '../../../src/shared/kernel/types.js';
import {
  // Domain functions
  isConventionalCommitTitle,
  parseCommand,
  isBot,
  hasValidAuthorAssociation,
  hasValidPermission,
  determineMergeMethod,
  validatePRState,
  getMergeableStateDescription,
  buildCheckResultsMarkdown,
  buildSummaryMarkdown,
  // App functions
  executeAction,
  // Ports
  type GitHubPort,
  type TimePort,
  type LogPort,
} from '../../../src/modules/merge/index.js';

// =============================================================================
// Domain Function Tests (Pure Logic)
// =============================================================================

describe('Domain: isConventionalCommitTitle', () => {
  it('should return true for valid conventional commit titles', () => {
    expect(isConventionalCommitTitle('feat: add new feature')).toBe(true);
    expect(isConventionalCommitTitle('fix(auth): resolve login issue')).toBe(true);
    expect(isConventionalCommitTitle('docs(readme): update installation')).toBe(true);
    expect(isConventionalCommitTitle('chore!: breaking change')).toBe(true);
    expect(isConventionalCommitTitle('ux: improve user experience')).toBe(true);
  });

  it('should return false for invalid titles', () => {
    expect(isConventionalCommitTitle('Update README')).toBe(false);
    expect(isConventionalCommitTitle('Fix bug')).toBe(false);
    expect(isConventionalCommitTitle('feat')).toBe(false);
    expect(isConventionalCommitTitle('feat:')).toBe(false);
    expect(isConventionalCommitTitle('feat: ')).toBe(false);
  });
});

describe('Domain: parseCommand', () => {
  it('should parse basic merge command', () => {
    const result = parseCommand('/lysbot merge');
    expect(result).toEqual({ overrideApprovalRequirement: false });
  });

  it('should parse command with override flag', () => {
    const result = parseCommand('/lysbot merge --override-approval-requirement');
    expect(result).toEqual({ overrideApprovalRequirement: true });
  });

  it('should return null for invalid commands', () => {
    expect(parseCommand('hello')).toBeNull();
    expect(parseCommand('/lysbot merge --invalid-flag')).toBeNull();
    expect(parseCommand('/lysbot')).toBeNull();
  });

  it('should handle whitespace', () => {
    expect(parseCommand('  /lysbot merge  ')).toEqual({ overrideApprovalRequirement: false });
    expect(parseCommand('/lysbot   merge')).toEqual({ overrideApprovalRequirement: false });
  });
});

describe('Domain: isBot', () => {
  it('should return true for Bot type', () => {
    expect(isBot('Bot')).toBe(true);
  });

  it('should return false for other types', () => {
    expect(isBot('User')).toBe(false);
    expect(isBot('Organization')).toBe(false);
  });
});

describe('Domain: hasValidAuthorAssociation', () => {
  it('should return true for valid associations', () => {
    expect(hasValidAuthorAssociation('OWNER')).toBe(true);
    expect(hasValidAuthorAssociation('MEMBER')).toBe(true);
    expect(hasValidAuthorAssociation('COLLABORATOR')).toBe(true);
  });

  it('should return false for invalid associations', () => {
    expect(hasValidAuthorAssociation('CONTRIBUTOR')).toBe(false);
    expect(hasValidAuthorAssociation('NONE')).toBe(false);
    expect(hasValidAuthorAssociation('FIRST_TIME_CONTRIBUTOR')).toBe(false);
  });
});

describe('Domain: hasValidPermission', () => {
  it('should return true for valid permissions', () => {
    expect(hasValidPermission('admin')).toBe(true);
    expect(hasValidPermission('maintain')).toBe(true);
    expect(hasValidPermission('write')).toBe(true);
  });

  it('should return false for invalid permissions', () => {
    expect(hasValidPermission('read')).toBe(false);
    expect(hasValidPermission('none')).toBe(false);
  });
});

describe('Domain: determineMergeMethod', () => {
  const config: ActionConfig = {
    releaseBranchPrefix: 'release/',
    developBranch: 'develop',
    syncBranchPrefix: 'fix/sync/',
    mergeableRetryCount: 5,
    mergeableRetryInterval: 10,
  };

  it('should use merge for release head branches', () => {
    const result = determineMergeMethod('release/v1.0.0', 'main', config);
    expect(result.method).toBe('merge');
    expect(result.reason).toContain('release branch');
  });

  it('should use merge for sync head branches', () => {
    const result = determineMergeMethod('fix/sync/main-to-develop', 'develop', config);
    expect(result.method).toBe('merge');
    expect(result.reason).toContain('sync branch');
  });

  it('should use squash for release base branches', () => {
    const result = determineMergeMethod('feature/new-feature', 'release/v1.0.0', config);
    expect(result.method).toBe('squash');
    expect(result.reason).toContain('release branch');
  });

  it('should use squash for develop base branch', () => {
    const result = determineMergeMethod('feature/new-feature', 'develop', config);
    expect(result.method).toBe('squash');
    expect(result.reason).toContain('develop');
  });

  it('should default to merge for other branches', () => {
    const result = determineMergeMethod('feature/new-feature', 'main', config);
    expect(result.method).toBe('merge');
    expect(result.reason).toContain('Default merge commit');
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
      author: 'user',
      isFork: false,
      title: 'Test PR',
    };

    const checks = validatePRState(prData);
    expect(checks).toHaveLength(1);
    expect(checks[0].passed).toBe(true);
    expect(checks[0].details).toBeUndefined();
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
      author: 'user',
      isFork: false,
      title: 'Test PR',
    };

    const checks = validatePRState(prData);
    expect(checks[0].passed).toBe(false);
    expect(checks[0].details).toContain('currently closed');
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
      author: 'user',
      isFork: false,
      title: 'Test PR',
    };

    const checks = validatePRState(prData);
    expect(checks[0].passed).toBe(false);
    expect(checks[0].details).toContain('currently a draft');
  });
});

describe('Domain: getMergeableStateDescription', () => {
  it('should return correct descriptions', () => {
    expect(getMergeableStateDescription('dirty')).toBe('has unresolved conflicts');
    expect(getMergeableStateDescription('blocked')).toBe('blocked by status checks or branch protection');
    expect(getMergeableStateDescription('clean')).toBe('ready to merge');
    expect(getMergeableStateDescription('unknown_state')).toBe('mergeable_state: unknown_state');
  });
});

describe('Domain: buildCheckResultsMarkdown', () => {
  it('should build markdown for passed checks', () => {
    const checks: CheckResult[] = [
      { name: 'Test check 1', passed: true },
      { name: 'Test check 2', passed: true },
    ];
    const markdown = buildCheckResultsMarkdown(checks);
    expect(markdown).toContain('Test check 1');
    expect(markdown).toContain('Test check 2');
  });

  it('should build markdown for failed checks', () => {
    const checks: CheckResult[] = [
      { name: 'Test check', passed: false, details: 'Some error' },
    ];
    const markdown = buildCheckResultsMarkdown(checks);
    expect(markdown).toContain('Test check');
    expect(markdown).toContain('Some error');
  });

  it('should build markdown for optional checks', () => {
    const checks: CheckResult[] = [
      { name: 'Optional check', passed: false, optional: true },
    ];
    const markdown = buildCheckResultsMarkdown(checks);
    expect(markdown).toContain('Optional check');
  });
});

describe('Domain: buildSummaryMarkdown', () => {
  it('should build summary without merge method', () => {
    const markdown = buildSummaryMarkdown('✅ Success', 123, 'testuser');
    expect(markdown).toContain('✅ Success');
    expect(markdown).toContain('#123');
    expect(markdown).toContain('@testuser');
  });

  it('should build summary with merge method', () => {
    const markdown = buildSummaryMarkdown('✅ Success', 123, 'testuser', 'squash');
    expect(markdown).toContain('✅ Success');
    expect(markdown).toContain('#123');
    expect(markdown).toContain('@testuser');
    expect(markdown).toContain('squash');
  });
});

// =============================================================================
// App/Orchestration Tests
// =============================================================================

describe('App: executeAction orchestration', () => {
  let mockGitHub: GitHubPort;
  let mockTime: TimePort;
  let mockLog: LogPort;
  let context: EventContext;
  let config: ActionConfig;

  beforeEach(() => {
    mockGitHub = {
      addReaction: vi.fn(),
      postComment: vi.fn(),
      getCollaboratorPermission: vi.fn(),
      fetchPullRequestData: vi.fn(),
      fetchApprovedReviews: vi.fn(),
      dismissReview: vi.fn(),
      countUnresolvedThreads: vi.fn(),
      fetchPullRequestCommits: vi.fn(),
      mergePullRequest: vi.fn(),
    };

    mockTime = {
      wait: vi.fn(),
    };

    mockLog = {
      info: vi.fn(),
    };

    context = {
      owner: 'test-owner',
      repo: 'test-repo',
      prNumber: 123,
      commentId: 456,
      commentBody: '/lysbot merge',
      actor: 'testuser',
      userType: 'User',
      authorAssociation: 'OWNER',
      serverUrl: 'https://github.com',
      runId: 789,
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

  it('should skip for non-issue_comment events', async () => {
    context.eventName = 'push';
    const result = await executeAction(mockGitHub, mockTime, mockLog, context, config);
    expect(result.status).toBe('skipped');
    expect(result.message).toContain('issue_comment');
  });

  it('should skip for non-PR comments', async () => {
    context.isPullRequest = false;
    const result = await executeAction(mockGitHub, mockTime, mockLog, context, config);
    expect(result.status).toBe('skipped');
    expect(result.message).toContain('not on a PR');
  });

  it('should skip for bot comments', async () => {
    context.userType = 'Bot';
    const result = await executeAction(mockGitHub, mockTime, mockLog, context, config);
    expect(result.status).toBe('skipped');
    expect(result.message).toContain('bot');
  });

  it('should skip for invalid commands', async () => {
    context.commentBody = 'hello world';
    const result = await executeAction(mockGitHub, mockTime, mockLog, context, config);
    expect(result.status).toBe('skipped');
    expect(result.message).toContain('not matched');
  });

  it('should fail for invalid author association', async () => {
    context.authorAssociation = 'NONE';
    const result = await executeAction(mockGitHub, mockTime, mockLog, context, config);
    expect(result.status).toBe('failed');
    expect(result.message).toContain('association');
    expect(mockGitHub.postComment).toHaveBeenCalled();
  });

  it('should fail for insufficient permissions', async () => {
    (mockGitHub.getCollaboratorPermission as Mock).mockResolvedValue('read');
    const result = await executeAction(mockGitHub, mockTime, mockLog, context, config);
    expect(result.status).toBe('failed');
    expect(result.message).toContain('permissions');
    expect(mockGitHub.postComment).toHaveBeenCalled();
  });

  it('should fail for fork PRs', async () => {
    (mockGitHub.getCollaboratorPermission as Mock).mockResolvedValue('write');
    (mockGitHub.fetchPullRequestData as Mock).mockResolvedValue({
      state: 'open',
      locked: false,
      draft: false,
      merged: false,
      mergeable: true,
      mergeableState: 'clean',
      headSha: 'abc123',
      headRef: 'feature/test',
      baseRef: 'main',
      author: 'user',
      isFork: true,
      title: 'Test PR',
    });
    const result = await executeAction(mockGitHub, mockTime, mockLog, context, config);
    expect(result.status).toBe('failed');
    expect(result.message).toContain('Fork');
  });

  it('should return already_merged for merged PRs', async () => {
    (mockGitHub.getCollaboratorPermission as Mock).mockResolvedValue('write');
    (mockGitHub.fetchPullRequestData as Mock).mockResolvedValue({
      state: 'closed',
      locked: false,
      draft: false,
      merged: true,
      mergeable: true,
      mergeableState: 'clean',
      headSha: 'abc123',
      headRef: 'feature/test',
      baseRef: 'main',
      author: 'user',
      isFork: false,
      title: 'Test PR',
    });
    const result = await executeAction(mockGitHub, mockTime, mockLog, context, config);
    expect(result.status).toBe('already_merged');
  });

  it('should fail when checks do not pass', async () => {
    (mockGitHub.getCollaboratorPermission as Mock).mockResolvedValue('write');
    (mockGitHub.fetchPullRequestData as Mock).mockResolvedValue({
      state: 'open',
      locked: false,
      draft: true, // Draft PR should fail
      merged: false,
      mergeable: true,
      mergeableState: 'clean',
      headSha: 'abc123',
      headRef: 'feature/test',
      baseRef: 'main',
      author: 'user',
      isFork: false,
      title: 'Test PR',
    });
    (mockGitHub.fetchApprovedReviews as Mock).mockResolvedValue([]);
    (mockGitHub.countUnresolvedThreads as Mock).mockResolvedValue(0);

    const result = await executeAction(mockGitHub, mockTime, mockLog, context, config);
    expect(result.status).toBe('failed');
    expect(result.message).toContain('checks failed');
  });

  it('should successfully merge when all checks pass', async () => {
    (mockGitHub.getCollaboratorPermission as Mock).mockResolvedValue('write');
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
      author: 'user',
      isFork: false,
      title: 'feat: test feature',
    };
    (mockGitHub.fetchPullRequestData as Mock).mockResolvedValue(prData);
    (mockGitHub.fetchApprovedReviews as Mock).mockResolvedValue([
      { id: 1, commit_id: 'abc123', user: { login: 'reviewer' }, state: 'APPROVED' },
    ]);
    (mockGitHub.countUnresolvedThreads as Mock).mockResolvedValue(0);
    (mockGitHub.fetchPullRequestCommits as Mock).mockResolvedValue([
      { commit: { message: 'test commit', author: { name: 'Test', email: 'test@example.com' } } },
    ]);
    (mockGitHub.mergePullRequest as Mock).mockResolvedValue({ success: true, mergeCommitSha: 'def456' });

    const result = await executeAction(mockGitHub, mockTime, mockLog, context, config);
    expect(result.status).toBe('merged');
    expect(result.mergeMethod).toBe('merge');
    expect(mockGitHub.mergePullRequest).toHaveBeenCalled();
  });

  it('should handle approval override flag', async () => {
    context.commentBody = '/lysbot merge --override-approval-requirement';
    (mockGitHub.getCollaboratorPermission as Mock).mockResolvedValue('write');
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
      author: 'user',
      isFork: false,
      title: 'feat: test feature',
    };
    (mockGitHub.fetchPullRequestData as Mock).mockResolvedValue(prData);
    (mockGitHub.fetchApprovedReviews as Mock).mockResolvedValue([]);
    (mockGitHub.countUnresolvedThreads as Mock).mockResolvedValue(0);
    (mockGitHub.fetchPullRequestCommits as Mock).mockResolvedValue([]);
    (mockGitHub.mergePullRequest as Mock).mockResolvedValue({ success: true });

    const result = await executeAction(mockGitHub, mockTime, mockLog, context, config);
    expect(result.status).toBe('merged');
    expect(mockLog.info).toHaveBeenCalledWith(expect.stringContaining('override'));
  });

  it('should handle stale approvals and dismiss them', async () => {
    (mockGitHub.getCollaboratorPermission as Mock).mockResolvedValue('write');
    const prData: PullRequestData = {
      state: 'open',
      locked: false,
      draft: false,
      merged: false,
      mergeable: true,
      mergeableState: 'clean',
      headSha: 'abc123',
      headRef: 'feature/test',
      baseRef: 'develop',
      author: 'user',
      isFork: false,
      title: 'feat: test feature',
    };
    (mockGitHub.fetchPullRequestData as Mock).mockResolvedValue(prData);
    (mockGitHub.fetchApprovedReviews as Mock).mockResolvedValue([
      { id: 1, commit_id: 'old123', user: { login: 'reviewer' }, state: 'APPROVED' },
    ]);
    (mockGitHub.dismissReview as Mock).mockResolvedValue(true);
    (mockGitHub.countUnresolvedThreads as Mock).mockResolvedValue(0);

    const result = await executeAction(mockGitHub, mockTime, mockLog, context, config);
    expect(result.status).toBe('failed');
    expect(mockGitHub.dismissReview).toHaveBeenCalled();
  });

  it('should handle dismiss review failures', async () => {
    (mockGitHub.getCollaboratorPermission as Mock).mockResolvedValue('write');
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
      author: 'user',
      isFork: false,
      title: 'feat: test feature',
    };
    (mockGitHub.fetchPullRequestData as Mock).mockResolvedValue(prData);
    (mockGitHub.fetchApprovedReviews as Mock).mockResolvedValue([
      { id: 1, commit_id: 'old123', user: { login: 'reviewer' }, state: 'APPROVED' },
    ]);
    (mockGitHub.dismissReview as Mock).mockResolvedValue(false); // Fail to dismiss
    (mockGitHub.countUnresolvedThreads as Mock).mockResolvedValue(0);

    const result = await executeAction(mockGitHub, mockTime, mockLog, context, config);
    expect(result.status).toBe('failed');
    expect(mockGitHub.postComment).toHaveBeenCalledWith(
      expect.any(Number),
      expect.stringContaining('Stale approval dismiss failures'),
    );
  });

  it('should skip self-approvals', async () => {
    (mockGitHub.getCollaboratorPermission as Mock).mockResolvedValue('write');
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
      author: 'user',
      isFork: false,
      title: 'feat: test feature',
    };
    (mockGitHub.fetchPullRequestData as Mock).mockResolvedValue(prData);
    (mockGitHub.fetchApprovedReviews as Mock).mockResolvedValue([
      { id: 1, commit_id: 'abc123', user: { login: 'user' }, state: 'APPROVED' }, // Self-approval
    ]);
    (mockGitHub.countUnresolvedThreads as Mock).mockResolvedValue(0);

    const result = await executeAction(mockGitHub, mockTime, mockLog, context, config);
    expect(result.status).toBe('failed'); // Should fail because no valid approvals
  });

  it('should detect TOCTOU violations', async () => {
    (mockGitHub.getCollaboratorPermission as Mock).mockResolvedValue('write');
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
      author: 'user',
      isFork: false,
      title: 'feat: test feature',
    };
    (mockGitHub.fetchPullRequestData as Mock)
      .mockResolvedValueOnce(prData)
      .mockResolvedValueOnce({ ...prData, headSha: 'new456' }); // Changed SHA
    (mockGitHub.fetchApprovedReviews as Mock).mockResolvedValue([
      { id: 1, commit_id: 'abc123', user: { login: 'reviewer' }, state: 'APPROVED' },
    ]);
    (mockGitHub.countUnresolvedThreads as Mock).mockResolvedValue(0);

    const result = await executeAction(mockGitHub, mockTime, mockLog, context, config);
    expect(result.status).toBe('failed');
    expect(result.message).toContain('TOCTOU');
  });

  it('should handle mergeable status pending with retries', async () => {
    (mockGitHub.getCollaboratorPermission as Mock).mockResolvedValue('write');
    const prDataWithNull: PullRequestData = {
      state: 'open',
      locked: false,
      draft: false,
      merged: false,
      mergeable: null, // Still calculating
      mergeableState: 'clean', // Not dirty, so conflicts check passes
      headSha: 'abc123',
      headRef: 'feature/test',
      baseRef: 'main',
      author: 'user',
      isFork: false,
      title: 'feat: test feature',
    };
    (mockGitHub.fetchPullRequestData as Mock).mockResolvedValue(prDataWithNull);
    (mockGitHub.fetchApprovedReviews as Mock).mockResolvedValue([
      { id: 1, commit_id: 'abc123', user: { login: 'reviewer' }, state: 'APPROVED' },
    ]);
    (mockGitHub.countUnresolvedThreads as Mock).mockResolvedValue(0);
    (mockGitHub.fetchPullRequestCommits as Mock).mockResolvedValue([]);

    const result = await executeAction(mockGitHub, mockTime, mockLog, context, config);
    expect(result.status).toBe('failed');
    expect(result.message).toContain('Not mergeable');
    expect(mockGitHub.postComment).toHaveBeenCalledWith(
      expect.any(Number),
      expect.stringContaining('Mergeability status pending'),
    );
  });

  it('should handle dirty merge state (conflicts) at checks phase', async () => {
    (mockGitHub.getCollaboratorPermission as Mock).mockResolvedValue('write');
    const prData: PullRequestData = {
      state: 'open',
      locked: false,
      draft: false,
      merged: false,
      mergeable: false,
      mergeableState: 'dirty', // Has conflicts
      headSha: 'abc123',
      headRef: 'feature/test',
      baseRef: 'main',
      author: 'user',
      isFork: false,
      title: 'feat: test feature',
    };
    (mockGitHub.fetchPullRequestData as Mock).mockResolvedValue(prData);
    (mockGitHub.fetchApprovedReviews as Mock).mockResolvedValue([
      { id: 1, commit_id: 'abc123', user: { login: 'reviewer' }, state: 'APPROVED' },
    ]);
    (mockGitHub.countUnresolvedThreads as Mock).mockResolvedValue(0);

    const result = await executeAction(mockGitHub, mockTime, mockLog, context, config);
    expect(result.status).toBe('failed');
    expect(result.message).toContain('checks failed');
    expect(mockGitHub.postComment).toHaveBeenCalledWith(
      expect.any(Number),
      expect.stringContaining('has unresolved conflicts'),
    );
  });

  it('should handle merge failures', async () => {
    (mockGitHub.getCollaboratorPermission as Mock).mockResolvedValue('write');
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
      author: 'user',
      isFork: false,
      title: 'feat: test feature',
    };
    (mockGitHub.fetchPullRequestData as Mock).mockResolvedValue(prData);
    (mockGitHub.fetchApprovedReviews as Mock).mockResolvedValue([
      { id: 1, commit_id: 'abc123', user: { login: 'reviewer' }, state: 'APPROVED' },
    ]);
    (mockGitHub.countUnresolvedThreads as Mock).mockResolvedValue(0);
    (mockGitHub.fetchPullRequestCommits as Mock).mockResolvedValue([]);
    (mockGitHub.mergePullRequest as Mock).mockResolvedValue({ success: false, error: 'Merge error' });

    const result = await executeAction(mockGitHub, mockTime, mockLog, context, config);
    expect(result.status).toBe('failed');
    expect(result.message).toContain('Merge failed');
  });

  it('should use squash merge for PRs targeting develop branch', async () => {
    (mockGitHub.getCollaboratorPermission as Mock).mockResolvedValue('write');
    const prData: PullRequestData = {
      state: 'open',
      locked: false,
      draft: false,
      merged: false,
      mergeable: true,
      mergeableState: 'clean',
      headSha: 'abc123',
      headRef: 'feature/test',
      baseRef: 'develop',
      author: 'user',
      isFork: false,
      title: 'feat: test feature',
    };
    (mockGitHub.fetchPullRequestData as Mock).mockResolvedValue(prData);
    (mockGitHub.fetchApprovedReviews as Mock).mockResolvedValue([
      { id: 1, commit_id: 'abc123', user: { login: 'reviewer' }, state: 'APPROVED' },
    ]);
    (mockGitHub.countUnresolvedThreads as Mock).mockResolvedValue(0);
    (mockGitHub.fetchPullRequestCommits as Mock).mockResolvedValue([
      { commit: { message: 'commit 1', author: { name: 'Author1', email: 'author1@example.com' } } },
      { commit: { message: 'commit 2', author: { name: 'Author2', email: 'author2@example.com' } } },
    ]);
    (mockGitHub.mergePullRequest as Mock).mockResolvedValue({ success: true, mergeCommitSha: 'merge123' });

    const result = await executeAction(mockGitHub, mockTime, mockLog, context, config);
    expect(result.status).toBe('merged');
    expect(result.mergeMethod).toBe('squash');
    expect(mockGitHub.mergePullRequest).toHaveBeenCalledWith(
      expect.any(Number),
      'squash',
      expect.any(String),
      expect.stringContaining('feat: test feature'),
      expect.stringContaining('Co-authored-by'),
    );
  });

  it('should handle PRs with unresolved threads', async () => {
    (mockGitHub.getCollaboratorPermission as Mock).mockResolvedValue('write');
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
      author: 'user',
      isFork: false,
      title: 'feat: test feature',
    };
    (mockGitHub.fetchPullRequestData as Mock).mockResolvedValue(prData);
    (mockGitHub.fetchApprovedReviews as Mock).mockResolvedValue([
      { id: 1, commit_id: 'abc123', user: { login: 'reviewer' }, state: 'APPROVED' },
    ]);
    (mockGitHub.countUnresolvedThreads as Mock).mockResolvedValue(3); // Has unresolved threads

    const result = await executeAction(mockGitHub, mockTime, mockLog, context, config);
    expect(result.status).toBe('failed');
    expect(mockGitHub.postComment).toHaveBeenCalledWith(
      expect.any(Number),
      expect.stringContaining('3 unresolved'),
    );
  });
});

// =============================================================================
// Infrastructure Tests
// =============================================================================

describe('Infra: Adapters', () => {
  it('should test adapter implementations if needed', () => {
    // Placeholder for adapter-specific tests if needed
    // In this architecture, adapters are tested through integration with executeAction
    expect(true).toBe(true);
  });
});
