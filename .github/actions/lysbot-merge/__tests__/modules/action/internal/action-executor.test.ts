/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, type MockedFunction } from 'vitest';

import { TWEMOJI } from '../../../../src/modules/action/index.js';
import { ActionExecutor } from '../../../../src/modules/action/internal/action-executor.js';
import { GitHubClient } from '../../../../src/modules/action/internal/github-client.js';
import type { ActionConfig, EventContext, Octokit } from '../../../../src/modules/action/internal/types.js';

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

const mockCore = {
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  getInput: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
  summary: {
    addRaw: vi.fn().mockReturnThis(),
    write: vi.fn(),
  },
};

describe('ActionExecutor', () => {
  describe('event type validation', () => {
    it('skips processing for non-issue_comment events', async () => {
      const octokit = createMockOctokit();
      const githubClient = new GitHubClient(octokit);
      const config = createConfig();
      const executor = new ActionExecutor(githubClient, config, mockCore as any);
      const context = createEventContext({ eventName: 'push' });

      const result = await executor.execute(context);

      expect(result.status).toBe('skipped');
      expect(result.message).toContain('issue_comment');
    });

    it('skips processing for issue comments (not PR comments)', async () => {
      const octokit = createMockOctokit();
      const githubClient = new GitHubClient(octokit);
      const config = createConfig();
      const executor = new ActionExecutor(githubClient, config, mockCore as any);
      const context = createEventContext({ isPullRequest: false });

      const result = await executor.execute(context);

      expect(result.status).toBe('skipped');
      expect(result.message).toContain('not on a PR');
    });
  });

  describe('command and user validation', () => {
    it('skips processing for bot comments', async () => {
      const octokit = createMockOctokit();
      const githubClient = new GitHubClient(octokit);
      const config = createConfig();
      const executor = new ActionExecutor(githubClient, config, mockCore as any);
      const context = createEventContext({ userType: 'Bot' });

      const result = await executor.execute(context);

      expect(result.status).toBe('skipped');
      expect(result.message).toContain('bot');
    });

    it('skips processing for non-matching command', async () => {
      const octokit = createMockOctokit();
      const githubClient = new GitHubClient(octokit);
      const config = createConfig();
      const executor = new ActionExecutor(githubClient, config, mockCore as any);
      const context = createEventContext({ commentBody: 'Hello world' });

      const result = await executor.execute(context);

      expect(result.status).toBe('skipped');
      expect(result.message).toContain('not matched');
    });

    it('fails for users without valid author association', async () => {
      const octokit = createMockOctokit();
      const githubClient = new GitHubClient(octokit);
      const config = createConfig();
      const executor = new ActionExecutor(githubClient, config, mockCore as any);
      const context = createEventContext({ authorAssociation: 'NONE' });

      const result = await executor.execute(context);

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
      const githubClient = new GitHubClient(octokit);
      const config = createConfig();
      const executor = new ActionExecutor(githubClient, config, mockCore as any);
      const context = createEventContext();

      const result = await executor.execute(context);

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
      const githubClient = new GitHubClient(octokit);
      const config = createConfig();
      const executor = new ActionExecutor(githubClient, config, mockCore as any);
      const context = createEventContext();

      const result = await executor.execute(context);

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
      const githubClient = new GitHubClient(octokit);
      const config = createConfig();
      const executor = new ActionExecutor(githubClient, config, mockCore as any);
      const context = createEventContext();

      const result = await executor.execute(context);

      expect(result.status).toBe('already_merged');
    });
  });

  describe('merge execution', () => {
    it('successfully merges PR with valid approval (uses squash for develop base)', async () => {
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
          return [{ commit: { message: 'feat: add feature' } }];
        }
      });

      const githubClient = new GitHubClient(octokit);
      const config = createConfig();
      const executor = new ActionExecutor(githubClient, config, mockCore as any);
      const context = createEventContext();

      const result = await executor.execute(context);

      expect(result.status).toBe('merged');
      expect(result.mergeMethod).toBe('squash');
    });

    it('fails when no valid approvals exist', async () => {
      const octokit = createMockOctokit();
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([]);

      const githubClient = new GitHubClient(octokit);
      const config = createConfig();
      const executor = new ActionExecutor(githubClient, config, mockCore as any);
      const context = createEventContext();

      const result = await executor.execute(context);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('checks failed');
    });

    it('Case A: fails when no approvals and no override flag, shows cross icon', async () => {
      const octokit = createMockOctokit();
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([]);

      const githubClient = new GitHubClient(octokit);
      const config = createConfig();
      const executor = new ActionExecutor(githubClient, config, mockCore as any);
      const context = createEventContext({ commentBody: '/lysbot merge' });

      const result = await executor.execute(context);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('checks failed');

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
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([]);

      const githubClient = new GitHubClient(octokit);
      const config = createConfig();
      const executor = new ActionExecutor(githubClient, config, mockCore as any);
      const context = createEventContext({ commentBody: '/lysbot merge --override-approval-requirement' });

      const result = await executor.execute(context);

      expect(result.status).toBe('merged');

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
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([]);

      (octokit.graphql as unknown as MockedFunction<typeof octokit.graphql>).mockResolvedValue({
        repository: {
          pullRequest: {
            reviewThreads: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [{ isResolved: false }],
            },
          },
        },
      });

      const githubClient = new GitHubClient(octokit);
      const config = createConfig();
      const executor = new ActionExecutor(githubClient, config, mockCore as any);
      const context = createEventContext({ commentBody: '/lysbot merge --override-approval-requirement' });

      const result = await executor.execute(context);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('checks failed');

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
          title: 'Update README',
        },
      } as unknown as Awaited<ReturnType<typeof octokit.rest.pulls.get>>);

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

      const githubClient = new GitHubClient(octokit);
      const config = createConfig();
      const executor = new ActionExecutor(githubClient, config, mockCore as any);
      const context = createEventContext();

      const result = await executor.execute(context);

      expect(result.status).toBe('merged');

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

      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([
        {
          id: 1,
          state: 'APPROVED',
          commit_id: 'oldcommit456',
          user: { login: 'reviewer' },
        },
      ]);

      const githubClient = new GitHubClient(octokit);
      const config = createConfig();
      const executor = new ActionExecutor(githubClient, config, mockCore as any);
      const context = createEventContext();

      const result = await executor.execute(context);

      expect(octokit.rest.pulls.dismissReview).toHaveBeenCalled();

      const commentCalls = (
        octokit.rest.issues.createComment as MockedFunction<typeof octokit.rest.issues.createComment>
      ).mock.calls;
      const hasStaleSuccessComment = commentCalls.some((call) => {
        const body = call[0]?.body;
        return body?.includes('Stale approvals dismissed');
      });
      expect(hasStaleSuccessComment).toBe(false);

      expect(result.status).toBe('failed');
    });

    it('handles dismiss failure and posts notification', async () => {
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

      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([
        {
          id: 1,
          state: 'APPROVED',
          commit_id: 'oldcommit456',
          user: { login: 'reviewer' },
        },
      ]);

      (octokit.rest.pulls.dismissReview as MockedFunction<typeof octokit.rest.pulls.dismissReview>).mockRejectedValue(
        new Error('Forbidden'),
      );

      const githubClient = new GitHubClient(octokit);
      const config = createConfig();
      const executor = new ActionExecutor(githubClient, config, mockCore as any);
      const context = createEventContext();

      const result = await executor.execute(context);

      expect(octokit.rest.issues.createComment).toHaveBeenCalled();
      const commentCalls = (
        octokit.rest.issues.createComment as MockedFunction<typeof octokit.rest.issues.createComment>
      ).mock.calls;
      const hasFailureComment = commentCalls.some((call) => {
        const body = call[0]?.body;
        return body?.includes('Failed to dismiss') || body?.includes('Dismiss failures');
      });
      expect(hasFailureComment).toBe(true);

      expect(result.status).toBe('failed');
    });
  });

  describe('TOCTOU and mergeability handling', () => {
    it('detects TOCTOU violation when HEAD changes during validation', async () => {
      const octokit = createMockOctokit();
      let callCount = 0;

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
              sha: callCount === 1 ? 'original123' : 'newhead456',
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

      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([
        {
          id: 1,
          state: 'APPROVED',
          commit_id: 'original123',
          user: { login: 'reviewer' },
        },
      ]);

      const githubClient = new GitHubClient(octokit);
      const config = createConfig();
      const executor = new ActionExecutor(githubClient, config, mockCore as any);
      const context = createEventContext();

      const result = await executor.execute(context);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('TOCTOU');
    });

    it('fails when mergeable remains null after retries', async () => {
      const octokit = createMockOctokit();
      let callCount = 0;

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

      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([
        {
          id: 1,
          state: 'APPROVED',
          commit_id: 'abc1234567890',
          user: { login: 'reviewer' },
        },
      ]);

      const githubClient = new GitHubClient(octokit);
      const config = createConfig({
        mergeableRetryCount: 2,
        mergeableRetryInterval: 0,
      });
      const executor = new ActionExecutor(githubClient, config, mockCore as any);
      const context = createEventContext();

      const result = await executor.execute(context);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('Not mergeable');
    });

    it('includes exceptional merge marker when override flag is used and takes effect', async () => {
      const octokit = createMockOctokit();

      let paginateCalls = 0;
      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockImplementation(async () => {
        paginateCalls++;
        if (paginateCalls === 1) {
          return [];
        } else {
          return [{ commit: { message: 'feat: test pull request' } }];
        }
      });

      const githubClient = new GitHubClient(octokit);
      const config = createConfig();
      const executor = new ActionExecutor(githubClient, config, mockCore as any);
      const context = createEventContext({ commentBody: '/lysbot merge --override-approval-requirement' });

      const result = await executor.execute(context);

      expect(result.status).toBe('merged');

      const mergeCalls = (octokit.rest.pulls.merge as MockedFunction<typeof octokit.rest.pulls.merge>).mock.calls;
      expect(mergeCalls.length).toBe(1);
      const commitTitle = mergeCalls[0]?.[0]?.commit_title ?? '';
      const commitMessage = mergeCalls[0]?.[0]?.commit_message ?? '';
      expect(commitTitle).toContain('feat: test pull request (#1)');
      expect(commitMessage).toContain('Merged-by: lysbot-merge');
      expect(commitMessage).toContain('EXCEPTIONAL MERGE');
      expect(commitMessage).toContain('--override-approval-requirement');
    });

    it('does NOT include exceptional merge marker when override flag is used but does not take effect', async () => {
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
          return [{ commit: { message: 'feat: test pull request' } }];
        }
      });

      const githubClient = new GitHubClient(octokit);
      const config = createConfig();
      const executor = new ActionExecutor(githubClient, config, mockCore as any);
      const context = createEventContext({ commentBody: '/lysbot merge --override-approval-requirement' });

      const result = await executor.execute(context);

      expect(result.status).toBe('merged');

      const mergeCalls = (octokit.rest.pulls.merge as MockedFunction<typeof octokit.rest.pulls.merge>).mock.calls;
      expect(mergeCalls.length).toBe(1);
      const commitMessage = mergeCalls[0]?.[0]?.commit_message ?? '';
      expect(commitMessage).toContain('Merged-by: lysbot-merge');
      expect(commitMessage).not.toContain('EXCEPTIONAL MERGE');
    });

    it('creates proper commit message for merge commits', async () => {
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

      (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue([
        {
          id: 1,
          state: 'APPROVED',
          commit_id: 'abc1234567890',
          user: { login: 'reviewer' },
        },
      ]);

      const githubClient = new GitHubClient(octokit);
      const config = createConfig();
      const executor = new ActionExecutor(githubClient, config, mockCore as any);
      const context = createEventContext();

      const result = await executor.execute(context);

      expect(result.status).toBe('merged');
      expect(result.mergeMethod).toBe('merge');

      const mergeCalls = (octokit.rest.pulls.merge as MockedFunction<typeof octokit.rest.pulls.merge>).mock.calls;
      expect(mergeCalls.length).toBe(1);

      const commitTitle = mergeCalls[0]?.[0]?.commit_title ?? '';
      const commitMessage = mergeCalls[0]?.[0]?.commit_message ?? '';

      expect(commitTitle).toBe('Merge pull request #1 from release/v1.0.0');

      expect(commitMessage).toContain('Release v1.0.0');
      expect(commitMessage).toContain('Merged-by: lysbot-merge');
    });

    it('creates proper commit message for squash commits with commit list', async () => {
      const octokit = createMockOctokit();

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

      const githubClient = new GitHubClient(octokit);
      const config = createConfig();
      const executor = new ActionExecutor(githubClient, config, mockCore as any);
      const context = createEventContext();

      const result = await executor.execute(context);

      expect(result.status).toBe('merged');
      expect(result.mergeMethod).toBe('squash');

      const mergeCalls = (octokit.rest.pulls.merge as MockedFunction<typeof octokit.rest.pulls.merge>).mock.calls;
      expect(mergeCalls.length).toBe(1);

      const commitTitle = mergeCalls[0]?.[0]?.commit_title ?? '';
      const commitMessage = mergeCalls[0]?.[0]?.commit_message ?? '';

      expect(commitTitle).toBe('feat: test pull request (#1)');

      expect(commitMessage).toContain('* feat: add new feature');
      expect(commitMessage).toContain('* fix: fix bug');
      expect(commitMessage).toContain('* docs: update readme');
      expect(commitMessage).not.toContain('Detailed description of the fix');

      expect(commitMessage).toContain('Co-authored-by: Bob Developer <bob@example.com>');
      expect(commitMessage).toContain('Co-authored-by: Alice Contributor <alice@example.com>');

      expect(commitMessage).toContain('Merged-by: lysbot-merge');
    });
  });
});

/* eslint-enable @typescript-eslint/no-explicit-any */
