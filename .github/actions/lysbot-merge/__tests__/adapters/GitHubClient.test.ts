/**
 * GitHubClient.test.ts - Tests for GitHubClient adapter
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import { GitHubClient } from '../../src/adapters/gateways/GitHubClient.js';

describe('GitHubClient', () => {
  let mockOctokit: {
    rest: {
      reactions: { createForIssueComment: ReturnType<typeof vi.fn> };
      issues: { createComment: ReturnType<typeof vi.fn> };
      repos: { getCollaboratorPermissionLevel: ReturnType<typeof vi.fn> };
      pulls: {
        get: ReturnType<typeof vi.fn>;
        listReviews: ReturnType<typeof vi.fn>;
        dismissReview: ReturnType<typeof vi.fn>;
        listCommits: ReturnType<typeof vi.fn>;
        merge: ReturnType<typeof vi.fn>;
      };
    };
    paginate: ReturnType<typeof vi.fn>;
    graphql: ReturnType<typeof vi.fn>;
  };
  let client: GitHubClient;

  beforeEach(() => {
    mockOctokit = {
      rest: {
        reactions: {
          createForIssueComment: vi.fn(),
        },
        issues: {
          createComment: vi.fn(),
        },
        repos: {
          getCollaboratorPermissionLevel: vi.fn(),
        },
        pulls: {
          get: vi.fn(),
          listReviews: vi.fn(),
          dismissReview: vi.fn(),
          listCommits: vi.fn(),
          merge: vi.fn(),
        },
      },
      paginate: vi.fn(),
      graphql: vi.fn(),
    };

    client = new GitHubClient(mockOctokit as never, 'test-owner', 'test-repo');
  });

  describe('addReaction', () => {
    it('should add reaction successfully', async () => {
      mockOctokit.rest.reactions.createForIssueComment.mockResolvedValue({});

      await client.addReaction(123, 'eyes');

      expect(mockOctokit.rest.reactions.createForIssueComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        comment_id: 123,
        content: 'eyes',
      });
    });

    it('should silently fail if reaction already exists', async () => {
      mockOctokit.rest.reactions.createForIssueComment.mockRejectedValue(new Error('Already exists'));

      await expect(client.addReaction(123, 'eyes')).resolves.toBeUndefined();
    });
  });

  describe('postComment', () => {
    it('should post comment successfully', async () => {
      mockOctokit.rest.issues.createComment.mockResolvedValue({});

      await client.postComment(123, 'Test comment');

      expect(mockOctokit.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        issue_number: 123,
        body: 'Test comment',
      });
    });
  });

  describe('getCollaboratorPermission', () => {
    it('should return permission level', async () => {
      mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockResolvedValue({
        data: { permission: 'write' },
      });

      const result = await client.getCollaboratorPermission('testuser');

      expect(result).toBe('write');
      expect(mockOctokit.rest.repos.getCollaboratorPermissionLevel).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        username: 'testuser',
      });
    });

    it('should return "none" on error', async () => {
      mockOctokit.rest.repos.getCollaboratorPermissionLevel.mockRejectedValue(new Error('Not found'));

      const result = await client.getCollaboratorPermission('testuser');

      expect(result).toBe('none');
    });
  });

  describe('fetchPullRequest', () => {
    it('should fetch and transform PR data', async () => {
      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: {
          state: 'open',
          locked: false,
          draft: false,
          merged: false,
          mergeable: true,
          mergeable_state: 'clean',
          head: { sha: 'abc123', ref: 'feature/test', repo: { fork: false, owner: { id: 1 } } },
          base: { ref: 'main', repo: { owner: { id: 1 } } },
          user: { login: 'author' },
          title: 'Test PR',
        },
      });

      const result = await client.fetchPullRequest(123);

      expect(result).toEqual({
        state: 'open',
        locked: false,
        draft: false,
        merged: false,
        mergeable: true,
        mergeableState: 'clean',
        headSha: 'abc123',
        headRef: 'feature/test',
        baseRef: 'main',
        author: 'author',
        isFork: false,
        title: 'Test PR',
      });
    });

    it('should detect fork when head repo fork flag is true', async () => {
      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: {
          state: 'open',
          locked: false,
          draft: false,
          merged: false,
          mergeable: true,
          mergeable_state: 'clean',
          head: { sha: 'abc123', ref: 'feature/test', repo: { fork: true, owner: { id: 2 } } },
          base: { ref: 'main', repo: { owner: { id: 1 } } },
          user: { login: 'author' },
          title: 'Test PR',
        },
      });

      const result = await client.fetchPullRequest(123);

      expect(result.isFork).toBe(true);
    });

    it('should detect fork when owner IDs differ', async () => {
      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: {
          state: 'open',
          locked: false,
          draft: false,
          merged: false,
          mergeable: true,
          mergeable_state: 'clean',
          head: { sha: 'abc123', ref: 'feature/test', repo: { fork: false, owner: { id: 2 } } },
          base: { ref: 'main', repo: { owner: { id: 1 } } },
          user: { login: 'author' },
          title: 'Test PR',
        },
      });

      const result = await client.fetchPullRequest(123);

      expect(result.isFork).toBe(true);
    });

    it('should handle draft field being undefined', async () => {
      mockOctokit.rest.pulls.get.mockResolvedValue({
        data: {
          state: 'open',
          locked: false,
          merged: false,
          mergeable: true,
          mergeable_state: 'clean',
          head: { sha: 'abc123', ref: 'feature/test', repo: { fork: false, owner: { id: 1 } } },
          base: { ref: 'main', repo: { owner: { id: 1 } } },
          user: { login: 'author' },
          title: 'Test PR',
        },
      });

      const result = await client.fetchPullRequest(123);

      expect(result.draft).toBe(false);
    });
  });

  describe('fetchApprovedReviews', () => {
    it('should fetch and filter approved reviews', async () => {
      mockOctokit.paginate.mockResolvedValue([
        { id: 1, state: 'APPROVED', commit_id: 'abc', user: { login: 'user1' } },
        { id: 2, state: 'CHANGES_REQUESTED', commit_id: 'def', user: { login: 'user2' } },
        { id: 3, state: 'APPROVED', commit_id: 'ghi', user: { login: 'user3' } },
      ]);

      const result = await client.fetchApprovedReviews(123);

      expect(result).toHaveLength(2);
      expect(result[0]?.state).toBe('APPROVED');
      expect(result[1]?.state).toBe('APPROVED');
    });
  });

  describe('dismissReview', () => {
    it('should dismiss review successfully', async () => {
      mockOctokit.rest.pulls.dismissReview.mockResolvedValue({});

      const result = await client.dismissReview(123, 456, 'Test message');

      expect(result).toBe(true);
      expect(mockOctokit.rest.pulls.dismissReview).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123,
        review_id: 456,
        message: 'Test message',
      });
    });

    it('should return false on error', async () => {
      mockOctokit.rest.pulls.dismissReview.mockRejectedValue(new Error('Permission denied'));

      const result = await client.dismissReview(123, 456, 'Test message');

      expect(result).toBe(false);
    });
  });

  describe('countUnresolvedThreads', () => {
    it('should count unresolved threads using GraphQL', async () => {
      mockOctokit.graphql.mockResolvedValue({
        repository: {
          pullRequest: {
            reviewThreads: {
              pageInfo: { hasNextPage: false, endCursor: null },
              nodes: [{ isResolved: false }, { isResolved: true }, { isResolved: false }],
            },
          },
        },
      });

      const result = await client.countUnresolvedThreads(123);

      expect(result).toBe(2);
    });

    it('should handle pagination', async () => {
      mockOctokit.graphql
        .mockResolvedValueOnce({
          repository: {
            pullRequest: {
              reviewThreads: {
                pageInfo: { hasNextPage: true, endCursor: 'cursor1' },
                nodes: [{ isResolved: false }, { isResolved: true }],
              },
            },
          },
        })
        .mockResolvedValueOnce({
          repository: {
            pullRequest: {
              reviewThreads: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [{ isResolved: false }],
              },
            },
          },
        });

      const result = await client.countUnresolvedThreads(123);

      expect(result).toBe(2);
      expect(mockOctokit.graphql).toHaveBeenCalledTimes(2);
    });
  });

  describe('fetchPullRequestCommits', () => {
    it('should fetch commits using paginate', async () => {
      const commits = [
        { commit: { message: 'feat: test', author: { name: 'Alice', email: 'alice@test.com' } } },
        { commit: { message: 'fix: bug', author: { name: 'Bob', email: 'bob@test.com' } } },
      ];
      mockOctokit.paginate.mockResolvedValue(commits);

      const result = await client.fetchPullRequestCommits(123);

      expect(result).toEqual(commits);
    });
  });

  describe('mergePullRequest', () => {
    it('should merge successfully', async () => {
      mockOctokit.rest.pulls.merge.mockResolvedValue({
        data: { sha: 'merge123' },
      });

      const result = await client.mergePullRequest(123, 'squash', 'abc123', 'Test title', 'Test body');

      expect(result).toEqual({
        success: true,
        mergeCommitSha: 'merge123',
      });
      expect(mockOctokit.rest.pulls.merge).toHaveBeenCalledWith({
        owner: 'test-owner',
        repo: 'test-repo',
        pull_number: 123,
        merge_method: 'squash',
        sha: 'abc123',
        commit_title: 'Test title',
        commit_message: 'Test body',
      });
    });

    it('should handle merge failure', async () => {
      mockOctokit.rest.pulls.merge.mockRejectedValue(new Error('Merge conflict'));

      const result = await client.mergePullRequest(123, 'squash', 'abc123', 'Test title', 'Test body');

      expect(result).toEqual({
        success: false,
        error: 'Merge conflict',
      });
    });

    it('should handle non-Error exceptions', async () => {
      mockOctokit.rest.pulls.merge.mockRejectedValue('String error');

      const result = await client.mergePullRequest(123, 'squash', 'abc123', 'Test title', 'Test body');

      expect(result).toEqual({
        success: false,
        error: 'Unknown error',
      });
    });
  });
});
