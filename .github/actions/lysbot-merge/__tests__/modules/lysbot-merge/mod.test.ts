/**
 * __tests__/modules/lysbot-merge/mod.test.ts - Tests for lysbot-merge module
 *
 * This file contains comprehensive tests for the lysbot-merge module,
 * including port-specific fakes.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  type MergeConfig,
  type EventContext,
  type PullRequestData,
  type CheckResult,
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

  async dismissReview(prNumber: number, reviewId: number, message: string): Promise<boolean> {
    this.dismissedReviews.push({ prNumber, reviewId, message });
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
    method: 'squash' | 'merge',
    sha: string,
    commitTitle: string,
    commitMessage: string,
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
    expect(checks[0].passed).toBe(true);
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
    expect(checks[0].passed).toBe(false);
    expect(checks[0].details).toContain('closed');
  });
});

describe('Domain: getMergeableStateDescription', () => {
  it('should return description for dirty state', () => {
    expect(getMergeableStateDescription('dirty')).toBe('has unresolved conflicts');
  });

  it('should return description for clean state', () => {
    expect(getMergeableStateDescription('clean')).toBe('ready to merge');
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
});

// ============================================================================
// App orchestration tests
// ============================================================================

describe('App: executeMerge', () => {
  let fakePort: FakeGitHubPort;
  let context: EventContext;
  let config: MergeConfig;

  beforeEach(() => {
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
});
