/**
 * github-api.test.ts - Unit tests for GitHub API adapter (OctokitGitHubClient)
 *
 * Tests cover the OctokitGitHubClient adapter implementation with mocked Octokit responses.
 */

import { describe, it, expect, vi, type MockedFunction } from 'vitest';

import { OctokitGitHubClient, type Octokit } from '../src/adapters/gateways/OctokitGitHubClient.js';

// =============================================================================
// Test Utilities
// =============================================================================

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
        listCommits: vi.fn().mockResolvedValue({ data: [] }),
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

// =============================================================================
// Tests for OctokitGitHubClient
// =============================================================================

describe('OctokitGitHubClient', () => {
  describe('addReaction', () => {
    it('should call createForIssueComment with correct parameters', async () => {
      const octokit = createMockOctokit();
      const client = new OctokitGitHubClient(octokit);

      await client.addReaction('owner', 'repo', 123, 'eyes');

      expect(octokit.rest.reactions.createForIssueComment).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        comment_id: 123,
        content: 'eyes',
      });
    });

    it('should not throw on error (silently fails)', async () => {
      const octokit = createMockOctokit();
      const client = new OctokitGitHubClient(octokit);
      (
        octokit.rest.reactions.createForIssueComment as MockedFunction<
          typeof octokit.rest.reactions.createForIssueComment
        >
      ).mockRejectedValue(new Error('Already exists'));

      await expect(client.addReaction('owner', 'repo', 123, 'eyes')).resolves.toBeUndefined();
    });
  });

  describe('postComment', () => {
    it('should call createComment with correct parameters', async () => {
      const octokit = createMockOctokit();
      const client = new OctokitGitHubClient(octokit);

      await client.postComment('owner', 'repo', 1, 'Test body');

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
      const client = new OctokitGitHubClient(octokit);

      const permission = await client.getCollaboratorPermission('owner', 'repo', 'user');

      expect(permission).toBe('write');
    });

    it('should return none on error', async () => {
      const octokit = createMockOctokit();
      const client = new OctokitGitHubClient(octokit);
      (
        octokit.rest.repos.getCollaboratorPermissionLevel as MockedFunction<
          typeof octokit.rest.repos.getCollaboratorPermissionLevel
        >
      ).mockRejectedValue(new Error('Not found'));

      const permission = await client.getCollaboratorPermission('owner', 'repo', 'user');
      expect(permission).toBe('none');
    });
  });

  describe('fetchPullRequest', () => {
    it('should parse PR data correctly', async () => {
      const octokit = createMockOctokit();
      const client = new OctokitGitHubClient(octokit);

      const prData = await client.fetchPullRequest('owner', 'repo', 1);

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
      const client = new OctokitGitHubClient(octokit);
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

      const prData = await client.fetchPullRequest('owner', 'repo', 1);
      expect(prData.isFork).toBe(true);
    });
  });

  describe('dismissReview', () => {
    it('should return true on success', async () => {
      const octokit = createMockOctokit();
      const client = new OctokitGitHubClient(octokit);

      const result = await client.dismissReview('owner', 'repo', 1, 123, 'Stale');

      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      const octokit = createMockOctokit();
      const client = new OctokitGitHubClient(octokit);
      (octokit.rest.pulls.dismissReview as MockedFunction<typeof octokit.rest.pulls.dismissReview>).mockRejectedValue(
        new Error('Forbidden'),
      );

      const result = await client.dismissReview('owner', 'repo', 1, 123, 'Stale');
      expect(result).toBe(false);
    });
  });

  describe('mergePullRequest', () => {
    it('should return success with SHA on successful merge', async () => {
      const octokit = createMockOctokit();
      const client = new OctokitGitHubClient(octokit);

      const result = await client.mergePullRequest('owner', 'repo', 1, 'squash', 'abc', 'title', 'body');

      expect(result.success).toBe(true);
      expect(result.mergeCommitSha).toBe('merge123456789');
    });

    it('should return error message on failure', async () => {
      const octokit = createMockOctokit();
      const client = new OctokitGitHubClient(octokit);
      (octokit.rest.pulls.merge as MockedFunction<typeof octokit.rest.pulls.merge>).mockRejectedValue(
        new Error('Merge conflict'),
      );

      const result = await client.mergePullRequest('owner', 'repo', 1, 'squash', 'abc', 'title', 'body');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Merge conflict');
    });
  });
});
