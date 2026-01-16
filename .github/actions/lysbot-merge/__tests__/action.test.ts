/**
 * action.test.ts - Tests for action.ts module
 *
 * Tests cover all functions exported from action.ts:
 * - executeAction: Main orchestration logic for merge operations
 * - buildSummaryMarkdown: Pure function for building markdown summaries
 */

import { describe, it, expect, vi, type MockedFunction } from 'vitest';

import { executeAction, buildSummaryMarkdown } from '../src/action.js';
import { EMOJI } from '../src/constants.js';
import type { ActionConfig, EventContext, Octokit } from '../src/types.js';

// =============================================================================
// Test Utilities
// =============================================================================

/**
 * Creates a default config for tests.
 */
function createConfig(overrides: Partial<ActionConfig> = {}): ActionConfig {
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
        listCommits: vi.fn().mockResolvedValue({ data: [] }),
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
    eventName: 'issue_comment',
    isPullRequest: true,
    ...overrides,
  };
}

describe('executeAction', () => {
  describe('event type validation', () => {
    it('skips processing for non-issue_comment events', async () => {
      const octokit = createMockOctokit();
      const context = createEventContext({ eventName: 'push' });
      const config = createConfig();

      const result = await executeAction(octokit, context, config);

      expect(result.status).toBe('skipped');
      expect(result.message).toContain('issue_comment');
    });

    it('skips processing for issue comments (not PR comments)', async () => {
      const octokit = createMockOctokit();
      const context = createEventContext({ isPullRequest: false });
      const config = createConfig();

      const result = await executeAction(octokit, context, config);

      expect(result.status).toBe('skipped');
      expect(result.message).toContain('not on a PR');
    });
  });

  describe('command and user validation', () => {
    it('skips processing for bot comments', async () => {
      const octokit = createMockOctokit();
      const context = createEventContext({ userType: 'Bot' });
      const config = createConfig();

      const result = await executeAction(octokit, context, config);

      expect(result.status).toBe('skipped');
      expect(result.message).toContain('bot');
    });

    it('skips processing for non-matching command', async () => {
      const octokit = createMockOctokit();
      const context = createEventContext({ commentBody: 'Hello world' });
      const config = createConfig();

      const result = await executeAction(octokit, context, config);

      expect(result.status).toBe('skipped');
      expect(result.message).toContain('not matched');
    });

    it('fails for users without valid author association', async () => {
      const octokit = createMockOctokit();
      const context = createEventContext({ authorAssociation: 'NONE' });
      const config = createConfig();

      const result = await executeAction(octokit, context, config);

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

      const result = await executeAction(octokit, context, config);

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

      const result = await executeAction(octokit, context, config);

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

      const result = await executeAction(octokit, context, config);

      expect(result.status).toBe('already_merged');
    });
  });

  describe('merge execution', () => {
    it('successfully merges PR with valid approval (uses squash for develop base)', async () => {
      const octokit = createMockOctokit();

      // Mock approved review from another user and commits
      let paginateCalls = 0;
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockImplementation(async () => {
        paginateCalls++;
        if (paginateCalls === 1) {
          // First call: approved reviews
          return [
            {
              id: 1,
              state: 'APPROVED',
              commit_id: 'abc1234567890',
              user: { login: 'reviewer' },
            },
          ];
        } else {
          // Second call: commits for squash merge
          return [{ commit: { message: 'feat: add feature' } }];
        }
      });

      const context = createEventContext();
      const config = createConfig();

      const result = await executeAction(octokit, context, config);

      expect(result.status).toBe('merged');
      expect(result.mergeMethod).toBe('squash'); // base is develop
    });

    it('fails when no valid approvals exist', async () => {
      const octokit = createMockOctokit();

      // No approved reviews
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([]);

      const context = createEventContext();
      const config = createConfig();

      const result = await executeAction(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('checks failed');
    });

    it('Case A: fails when no approvals and no override flag, shows cross icon', async () => {
      const octokit = createMockOctokit();

      // No approved reviews
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([]);

      const context = createEventContext({ commentBody: '/lysbot merge' });
      const config = createConfig();

      const result = await executeAction(octokit, context, config);

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
      expect(commentBody).toContain(EMOJI.CROSS);
      expect(commentBody).toContain('At least one valid approval');
      expect(commentBody).toContain('no valid approvals found');
    });

    it('Case B: succeeds with override flag when no approvals, shows warning icon', async () => {
      const octokit = createMockOctokit();

      // No approved reviews
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([]);

      const context = createEventContext({ commentBody: '/lysbot merge --override-approval-requirement' });
      const config = createConfig();

      const result = await executeAction(octokit, context, config);

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
      expect(commentBody).toContain(EMOJI.WARNING);
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

      const result = await executeAction(octokit, context, config);

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
      expect(commentBody).toContain(EMOJI.CROSS);
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

      // Mock approved review from another user and commits
      let paginateCalls = 0;
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockImplementation(async () => {
        paginateCalls++;
        if (paginateCalls === 1) {
          return [
            {
              id: 1,
              state: 'APPROVED',
              commit_id: 'abc1234567890',
              user: { login: 'reviewer' },
            },
          ];
        } else {
          return [{ commit: { message: 'Update README' } }];
        }
      });

      const context = createEventContext();
      const config = createConfig();

      const result = await executeAction(octokit, context, config);

      // Should still merge successfully (conventional commits is optional)
      expect(result.status).toBe('merged');

      // Verify the warning icon was used for conventional commits check
      const commentCalls = (
        octokit.rest.issues.createComment as MockedFunction<typeof octokit.rest.issues.createComment>
      ).mock.calls;
      const hasConventionalCommitsWarning = commentCalls.some((call) => {
        const body = call[0]?.body;
        return body?.includes('Conventional Commits') && body?.includes(EMOJI.WARNING);
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

      const result = await executeAction(octokit, context, config);

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

      const result = await executeAction(octokit, context, config);

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

      // Mock approved review from another user and commits
      let paginateCalls = 0;
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockImplementation(async () => {
        paginateCalls++;
        if (paginateCalls === 1) {
          return [
            {
              id: 1,
              state: 'APPROVED',
              commit_id: 'abc1234567890',
              user: { login: 'reviewer' },
            },
          ];
        } else {
          return [{ commit: { message: 'Update README' } }];
        }
      });

      const context = createEventContext();
      const config = createConfig();

      const result = await executeAction(octokit, context, config);

      // Should still merge successfully (conventional commits is optional)
      expect(result.status).toBe('merged');
      expect(result.mergeMethod).toBe('squash');

      // Verify the warning icon was used in the comment
      const commentCalls = (
        octokit.rest.issues.createComment as MockedFunction<typeof octokit.rest.issues.createComment>
      ).mock.calls;
      const hasConventionalCommitsCheck = commentCalls.some((call) => {
        const body = call[0]?.body;
        return body?.includes('Conventional Commits') && body?.includes(EMOJI.WARNING);
      });
      expect(hasConventionalCommitsCheck).toBe(true);
    });

    it('merges PR with conventional title and shows check mark', async () => {
      const octokit = createMockOctokit();

      // Mock approved review from another user and commits
      let paginateCalls = 0;
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockImplementation(async () => {
        paginateCalls++;
        if (paginateCalls === 1) {
          return [
            {
              id: 1,
              state: 'APPROVED',
              commit_id: 'abc1234567890',
              user: { login: 'reviewer' },
            },
          ];
        } else {
          return [{ commit: { message: 'feat: add feature' } }];
        }
      });

      const context = createEventContext();
      const config = createConfig();

      const result = await executeAction(octokit, context, config);

      // Should merge successfully
      expect(result.status).toBe('merged');

      // Verify the check icon was used for conventional commits
      const commentCalls = (
        octokit.rest.issues.createComment as MockedFunction<typeof octokit.rest.issues.createComment>
      ).mock.calls;
      const hasConventionalCommitsCheck = commentCalls.some((call) => {
        const body = call[0]?.body;
        return body?.includes('Conventional Commits') && body?.includes(EMOJI.CHECK);
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

      const result = await executeAction(octokit, context, config);

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

      // Mock valid approval and commits
      let paginateCalls = 0;
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockImplementation(async () => {
        paginateCalls++;
        if (paginateCalls === 1) {
          return [
            {
              id: 1,
              state: 'APPROVED',
              commit_id: 'abc1234567890',
              user: { login: 'reviewer' },
            },
          ];
        } else {
          return [{ commit: { message: 'feat: test pull request' } }];
        }
      });

      const context = createEventContext();
      const config = createConfig({
        mergeableRetryCount: 5,
        mergeableRetryInterval: 0, // No delay in tests
      });

      const result = await executeAction(octokit, context, config);

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

      const result = await executeAction(octokit, context, config);

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

      const result = await executeAction(octokit, context, config);

      expect(result.status).toBe('failed');
    });

    it('handles merge API failure', async () => {
      const octokit = createMockOctokit();

      // Mock valid approval and commits
      let paginateCalls = 0;
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockImplementation(async () => {
        paginateCalls++;
        if (paginateCalls === 1) {
          return [
            {
              id: 1,
              state: 'APPROVED',
              commit_id: 'abc1234567890',
              user: { login: 'reviewer' },
            },
          ];
        } else {
          return [{ commit: { message: 'feat: test pull request' } }];
        }
      });

      // Mock merge to fail
      (octokit.rest.pulls.merge as MockedFunction<typeof octokit.rest.pulls.merge>).mockRejectedValue(
        new Error('Merge conflict'),
      );

      const context = createEventContext();
      const config = createConfig();

      const result = await executeAction(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('Merge failed');
    });

    it('includes exceptional merge marker when override flag is used and takes effect', async () => {
      const octokit = createMockOctokit();

      // No approved reviews (override will take effect) but with commits for squash
      let paginateCalls = 0;
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockImplementation(async () => {
        paginateCalls++;
        if (paginateCalls === 1) {
          return []; // No reviews
        } else {
          return [{ commit: { message: 'feat: test pull request' } }]; // Commits for squash
        }
      });

      const context = createEventContext({ commentBody: '/lysbot merge --override-approval-requirement' });
      const config = createConfig();

      const result = await executeAction(octokit, context, config);

      expect(result.status).toBe('merged');

      // Verify the merge was called with the exceptional merge marker
      const mergeCalls = (octokit.rest.pulls.merge as MockedFunction<typeof octokit.rest.pulls.merge>).mock.calls;
      expect(mergeCalls.length).toBe(1);
      const commitTitle = mergeCalls[0]?.[0]?.commit_title ?? '';
      const commitMessage = mergeCalls[0]?.[0]?.commit_message ?? '';
      // For squash merge (base is develop)
      expect(commitTitle).toContain('feat: test pull request (#1)');
      expect(commitMessage).toContain('Merged-by: lysbot-merge');
      expect(commitMessage).toContain('EXCEPTIONAL MERGE');
      expect(commitMessage).toContain('--override-approval-requirement');
    });

    it('does NOT include exceptional merge marker when override flag is used but does not take effect', async () => {
      const octokit = createMockOctokit();

      // Mock valid approval (override will NOT take effect) and commits
      let paginateCalls = 0;
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockImplementation(async () => {
        paginateCalls++;
        if (paginateCalls === 1) {
          return [
            {
              id: 1,
              state: 'APPROVED',
              commit_id: 'abc1234567890',
              user: { login: 'reviewer' },
            },
          ];
        } else {
          return [{ commit: { message: 'feat: test pull request' } }];
        }
      });

      const context = createEventContext({ commentBody: '/lysbot merge --override-approval-requirement' });
      const config = createConfig();

      const result = await executeAction(octokit, context, config);

      expect(result.status).toBe('merged');

      // Verify the merge was called WITHOUT the exceptional merge marker
      const mergeCalls = (octokit.rest.pulls.merge as MockedFunction<typeof octokit.rest.pulls.merge>).mock.calls;
      expect(mergeCalls.length).toBe(1);
      const commitMessage = mergeCalls[0]?.[0]?.commit_message ?? '';
      expect(commitMessage).toContain('Merged-by: lysbot-merge');
      expect(commitMessage).not.toContain('EXCEPTIONAL MERGE');
    });

    it('creates proper commit message for merge commits', async () => {
      const octokit = createMockOctokit();

      // Mock for release branch (uses merge commit)
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
            ref: 'release/v1.0.0',
            repo: { fork: false, owner: { id: 1 } },
          },
          base: {
            ref: 'main',
            repo: { owner: { id: 1 } },
          },
          user: { login: 'testuser' },
          title: 'Release v1.0.0',
        },
      } as unknown as Awaited<ReturnType<typeof octokit.rest.pulls.get>>);

      // Mock approved review
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

      const result = await executeAction(octokit, context, config);

      expect(result.status).toBe('merged');
      expect(result.mergeMethod).toBe('merge'); // release branch uses merge

      // Verify commit message format for merge commits
      const mergeCalls = (octokit.rest.pulls.merge as MockedFunction<typeof octokit.rest.pulls.merge>).mock.calls;
      expect(mergeCalls.length).toBe(1);

      const commitTitle = mergeCalls[0]?.[0]?.commit_title ?? '';
      const commitMessage = mergeCalls[0]?.[0]?.commit_message ?? '';

      // Title: Merge pull request #{PR_NUMBER} from {PR_MERGE_HEAD}
      expect(commitTitle).toBe('Merge pull request #1 from release/v1.0.0');

      // Body: {PR_TITLE}\n\n{ADDITIONAL_MESSAGES}
      expect(commitMessage).toContain('Release v1.0.0');
      expect(commitMessage).toContain('Merged-by: lysbot-merge');
    });

    it('creates proper commit message for squash commits with commit list', async () => {
      const octokit = createMockOctokit();

      // Mock commits in the PR with author information
      const mockCommits = [
        {
          commit: {
            message: 'feat: add new feature',
            author: { name: 'Bob Developer', email: 'bob@example.com' },
          },
        },
        {
          commit: {
            message: 'fix: fix bug\n\nDetailed description of the fix',
            author: { name: 'Alice Contributor', email: 'alice@example.com' },
          },
        },
        {
          commit: {
            message: 'docs: update readme',
            author: { name: 'Bob Developer', email: 'bob@example.com' },
          },
        },
      ];

      let paginateCalls = 0;
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockImplementation(async () => {
        paginateCalls++;
        // First call is for approved reviews, second is for commits
        if (paginateCalls === 1) {
          return [
            {
              id: 1,
              state: 'APPROVED',
              commit_id: 'abc1234567890',
              user: { login: 'reviewer' },
            },
          ];
        } else {
          return mockCommits;
        }
      });

      const context = createEventContext();
      const config = createConfig();

      const result = await executeAction(octokit, context, config);

      expect(result.status).toBe('merged');
      expect(result.mergeMethod).toBe('squash'); // develop base uses squash

      // Verify commit message format for squash commits
      const mergeCalls = (octokit.rest.pulls.merge as MockedFunction<typeof octokit.rest.pulls.merge>).mock.calls;
      expect(mergeCalls.length).toBe(1);

      const commitTitle = mergeCalls[0]?.[0]?.commit_title ?? '';
      const commitMessage = mergeCalls[0]?.[0]?.commit_message ?? '';

      // Title: {PR_TITLE} (#{PR_NUMBER})
      expect(commitTitle).toBe('feat: test pull request (#1)');

      // Body: * {COMMIT_TITLE_01}\n* {COMMIT_TITLE_02}\n...\n\nCo-authored-by: ...\n\n{ADDITIONAL_MESSAGES}
      expect(commitMessage).toContain('* feat: add new feature');
      expect(commitMessage).toContain('* fix: fix bug');
      expect(commitMessage).toContain('* docs: update readme');
      expect(commitMessage).not.toContain('Detailed description of the fix'); // Only titles, not full messages

      // Verify Co-authored-by entries (should be alphabetically sorted)
      expect(commitMessage).toContain('Co-authored-by: Bob Developer <bob@example.com>');
      expect(commitMessage).toContain('Co-authored-by: Alice Contributor <alice@example.com>');

      expect(commitMessage).toContain('Merged-by: lysbot-merge');
    });

    it('creates proper commit message for squash commits with no commits', async () => {
      const octokit = createMockOctokit();

      let paginateCalls = 0;
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockImplementation(async () => {
        paginateCalls++;
        if (paginateCalls === 1) {
          return [
            {
              id: 1,
              state: 'APPROVED',
              commit_id: 'abc1234567890',
              user: { login: 'reviewer' },
            },
          ];
        } else {
          return []; // No commits
        }
      });

      const context = createEventContext();
      const config = createConfig();

      const result = await executeAction(octokit, context, config);

      expect(result.status).toBe('merged');
      const mergeCalls = (octokit.rest.pulls.merge as MockedFunction<typeof octokit.rest.pulls.merge>).mock.calls;
      const commitMessage = mergeCalls[0]?.[0]?.commit_message ?? '';

      // Should only contain additional messages, no commit list
      expect(commitMessage).toBe('Merged-by: lysbot-merge (on behalf of @testactor)');
      expect(commitMessage).not.toContain('*');
    });

    it('handles commits with empty messages in squash merge', async () => {
      const octokit = createMockOctokit();

      const mockCommits = [
        { commit: { message: 'feat: valid commit' } },
        { commit: { message: '' } }, // Empty message
        { commit: { message: '\n\nOnly has body' } }, // Empty first line
        { commit: { message: 'fix: another valid commit' } },
      ];

      let paginateCalls = 0;
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockImplementation(async () => {
        paginateCalls++;
        if (paginateCalls === 1) {
          return [
            {
              id: 1,
              state: 'APPROVED',
              commit_id: 'abc1234567890',
              user: { login: 'reviewer' },
            },
          ];
        } else {
          return mockCommits;
        }
      });

      const context = createEventContext();
      const config = createConfig();

      const result = await executeAction(octokit, context, config);

      expect(result.status).toBe('merged');

      const mergeCalls = (octokit.rest.pulls.merge as MockedFunction<typeof octokit.rest.pulls.merge>).mock.calls;
      const commitMessage = mergeCalls[0]?.[0]?.commit_message ?? '';

      // Verify only valid commit titles are included
      expect(commitMessage).toContain('* feat: valid commit');
      expect(commitMessage).toContain('* fix: another valid commit');
      // Verify empty messages are filtered out (shouldn't have extra bullets)
      const bulletCount = (commitMessage.match(/^\*/gm) || []).length;
      expect(bulletCount).toBe(2); // Only 2 valid commits
    });

    it('includes Co-authored-by entries in squash merge and deduplicates authors', async () => {
      const octokit = createMockOctokit();

      const mockCommits = [
        {
          commit: {
            message: 'feat: commit by Bob',
            author: { name: 'Bob Developer', email: 'bob@example.com' },
          },
        },
        {
          commit: {
            message: 'fix: commit by Alice',
            author: { name: 'Alice Contributor', email: 'alice@example.com' },
          },
        },
        {
          commit: {
            message: 'chore: another commit by Bob',
            author: { name: 'Bob Developer', email: 'bob@example.com' },
          },
        },
        {
          commit: {
            message: 'docs: commit without author info',
            // No author info
          },
        },
      ];

      let paginateCalls = 0;
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockImplementation(async () => {
        paginateCalls++;
        if (paginateCalls === 1) {
          return [
            {
              id: 1,
              state: 'APPROVED',
              commit_id: 'abc1234567890',
              user: { login: 'reviewer' },
            },
          ];
        } else {
          return mockCommits;
        }
      });

      const context = createEventContext();
      const config = createConfig();

      const result = await executeAction(octokit, context, config);

      expect(result.status).toBe('merged');

      const mergeCalls = (octokit.rest.pulls.merge as MockedFunction<typeof octokit.rest.pulls.merge>).mock.calls;
      const commitMessage = mergeCalls[0]?.[0]?.commit_message ?? '';

      // Verify Co-authored-by entries are present and deduplicated
      expect(commitMessage).toContain('Co-authored-by: Bob Developer <bob@example.com>');
      expect(commitMessage).toContain('Co-authored-by: Alice Contributor <alice@example.com>');

      // Verify Bob appears only once (deduplicated - first occurrence only)
      const bobMatches = commitMessage.match(/Co-authored-by: Bob Developer/g) || [];
      expect(bobMatches.length).toBe(1);

      // Verify Co-authored-by appears in the correct position (after commit list, before additional messages)
      const parts = commitMessage.split('\n\n');
      expect(parts.length).toBeGreaterThanOrEqual(3);
      expect(parts.at(1)).toContain('Co-authored-by:');

      // Verify order is by commit order (Bob first, then Alice), not alphabetical
      const coAuthorSection = parts.at(1);
      expect(coAuthorSection).toBeDefined();
      if (coAuthorSection) {
        const bobIndex = coAuthorSection.indexOf('Co-authored-by: Bob Developer');
        const aliceIndex = coAuthorSection.indexOf('Co-authored-by: Alice Contributor');
        expect(bobIndex).toBeLessThan(aliceIndex); // Bob should appear before Alice (commit order)
      }
      expect(parts.at(-1)).toContain('Merged-by: lysbot-merge');
    });
  });
});

describe('buildSummaryMarkdown', () => {
  it('builds summary with all parameters provided', () => {
    const result = buildSummaryMarkdown('✅ Merged successfully', 123, 'testuser', 'squash');

    expect(result).toContain('## lysbot-merge Summary');
    expect(result).toContain('| **Result** | ✅ Merged successfully |');
    expect(result).toContain('| **PR** | #123 |');
    expect(result).toContain('| **Triggered by** | @testuser |');
    expect(result).toContain('| **Merge Method** | `squash` |');
  });

  it('builds summary without optional parameters', () => {
    const result = buildSummaryMarkdown('⏭️ Skipped', 456, 'anotheruser');

    expect(result).toContain('## lysbot-merge Summary');
    expect(result).toContain('| **Result** | ⏭️ Skipped |');
    expect(result).toContain('| **PR** | #456 |');
    expect(result).toContain('| **Triggered by** | @anotheruser |');
    expect(result).not.toContain('Merge Method');
  });

  it('builds summary with only mergeMethod', () => {
    const result = buildSummaryMarkdown('✅ Merged successfully', 111, 'mergeuser', 'merge');

    expect(result).toContain('| **Merge Method** | `merge` |');
  });

  it('creates valid markdown table structure', () => {
    const result = buildSummaryMarkdown('✅ Test', 1, 'user');

    // Check for markdown table headers
    expect(result).toContain('| Item | Value |');
    expect(result).toContain('|------|-------|');

    // Should have proper line breaks
    const lines = result.split('\n');
    expect(lines.length).toBeGreaterThan(3);

    // Each data row should have pipe delimiters
    const dataLines = lines.filter((line) => line.includes('**'));
    dataLines.forEach((line) => {
      expect(line).toMatch(/^\|.*\|$/);
    });
  });

  it('escapes special characters properly in result text', () => {
    const result = buildSummaryMarkdown('⚠️ Warning: <special>', 333, 'special-user_123');

    expect(result).toContain('⚠️ Warning: <special>');
    expect(result).toContain('@special-user_123');
  });

  it('handles different result emojis and text', () => {
    const testCases = ['✅ Merged successfully', '⏭️ Skipped', '❌ Failed', 'ℹ️ Already merged'];

    testCases.forEach((resultText) => {
      const result = buildSummaryMarkdown(resultText, 1, 'user');
      expect(result).toContain(`| **Result** | ${resultText} |`);
    });
  });

  it('handles different PR numbers', () => {
    const testCases = [1, 42, 999, 12345];

    testCases.forEach((prNumber) => {
      const result = buildSummaryMarkdown('✅ Test', prNumber, 'user');
      expect(result).toContain(`| **PR** | #${prNumber} |`);
    });
  });

  it('handles different actors', () => {
    const testCases = ['alice', 'bob-smith', 'user_123', 'dependabot[bot]'];

    testCases.forEach((actor) => {
      const result = buildSummaryMarkdown('✅ Test', 1, actor);
      expect(result).toContain(`| **Triggered by** | @${actor} |`);
    });
  });
});
