/**
 * github-api.test.ts - Tests for GitHub API interaction functions
 *
 * Tests cover all GitHub API interaction functions from github-api.ts
 * using mocked Octokit responses. These tests verify:
 * - API call parameters and payloads
 * - Response handling and data transformation
 * - Error handling for API failures
 */

import { describe, it, expect, vi, type MockedFunction } from 'vitest';

import {
  addReaction,
  postComment,
  getCollaboratorPermission,
  fetchPullRequestData,
  dismissReview,
  countUnresolvedThreads,
  mergePullRequest,
  fetchPullRequestCommits,
} from '../src/github-api.js';
import type { Octokit } from '../src/types.js';

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

describe('fetchPullRequestCommits', () => {
  it('should fetch and return commits from a PR with author information', async () => {
    const octokit = createMockOctokit();
    const mockCommits = [
      { commit: { message: 'feat: add new feature', author: { name: 'Alice', email: 'alice@example.com' } } },
      {
        commit: { message: 'fix: fix bug\n\nDetailed description', author: { name: 'Bob', email: 'bob@example.com' } },
      },
      { commit: { message: 'docs: update readme' } },
    ];
    (octokit.paginate as unknown as MockedFunction<typeof octokit.paginate>).mockResolvedValue(mockCommits);

    const commits = await fetchPullRequestCommits(octokit, 'owner', 'repo', 1);

    expect(commits).toHaveLength(3);
    expect(commits[0]?.commit.message).toBe('feat: add new feature');
    expect(commits[0]?.commit.author?.name).toBe('Alice');
    expect(commits[0]?.commit.author?.email).toBe('alice@example.com');
    expect(commits[1]?.commit.message).toBe('fix: fix bug\n\nDetailed description');
    expect(commits[2]?.commit.message).toBe('docs: update readme');
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
      'Merge title',
      'Merge message body',
    );

    expect(result.success).toBe(true);
    expect(result.mergeCommitSha).toBe('merge123456789');
  });

  it('should return error message on failure', async () => {
    const octokit = createMockOctokit();
    (octokit.rest.pulls.merge as MockedFunction<typeof octokit.rest.pulls.merge>).mockRejectedValue(
      new Error('Merge conflict'),
    );

    const result = await mergePullRequest(
      octokit,
      'owner',
      'repo',
      1,
      'squash',
      'abc123',
      'Merge title',
      'Merge message body',
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('Merge conflict');
  });
});
