/**
 * main.test.ts - Integration tests for merge orchestration logic
 *
 * Tests cover the main lysbotMerge function with all validation and merge flows.
 * GitHub API interactions are mocked for isolation.
 */

import { describe, it, expect, vi, type MockedFunction } from 'vitest';
import type { LysbotMergeConfig, EventContext, PullRequestData, Octokit } from './types';
import { TWEMOJI } from './constants';
import { lysbotMerge } from './action';

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

    it('includes exceptional merge marker when override flag is used and takes effect', async () => {
      const octokit = createMockOctokit();

      // No approved reviews (override will take effect)
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([]);

      const context = createEventContext({ commentBody: '/lysbot merge --override-approval-requirement' });
      const config = createConfig();

      const result = await lysbotMerge(octokit, context, config);

      expect(result.status).toBe('merged');

      // Verify the merge was called with the exceptional merge marker
      const mergeCalls = (octokit.rest.pulls.merge as MockedFunction<typeof octokit.rest.pulls.merge>).mock.calls;
      expect(mergeCalls.length).toBe(1);
      const commitMessage = mergeCalls[0]?.[0]?.commit_message ?? '';
      expect(commitMessage).toContain('Merged-by: lysbot-merge');
      expect(commitMessage).toContain('EXCEPTIONAL MERGE');
      expect(commitMessage).toContain('--override-approval-requirement');
    });

    it('does NOT include exceptional merge marker when override flag is used but does not take effect', async () => {
      const octokit = createMockOctokit();

      // Mock valid approval (override will NOT take effect)
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([
        {
          id: 1,
          state: 'APPROVED',
          commit_id: 'abc1234567890',
          user: { login: 'reviewer' },
        },
      ]);

      const context = createEventContext({ commentBody: '/lysbot merge --override-approval-requirement' });
      const config = createConfig();

      const result = await lysbotMerge(octokit, context, config);

      expect(result.status).toBe('merged');

      // Verify the merge was called WITHOUT the exceptional merge marker
      const mergeCalls = (octokit.rest.pulls.merge as MockedFunction<typeof octokit.rest.pulls.merge>).mock.calls;
      expect(mergeCalls.length).toBe(1);
      const commitMessage = mergeCalls[0]?.[0]?.commit_message ?? '';
      expect(commitMessage).toContain('Merged-by: lysbot-merge');
      expect(commitMessage).not.toContain('EXCEPTIONAL MERGE');
    });
  });
});
