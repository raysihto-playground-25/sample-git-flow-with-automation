import { describe, expect, it } from 'vitest';

import {
  addReaction,
  countUnresolvedThreads,
  dismissReview,
  fetchApprovedReviews,
  fetchPullRequestCommits,
  fetchPullRequestData,
  getCollaboratorPermission,
  mergePullRequest,
  postComment,
} from '../../../../src/modules/merge/internal/github-client.js';
import type { Octokit } from '../../../../src/modules/merge/internal/types.js';
import { createMockOctokit } from '../../../helpers/fixtures.js';

describe('github-client', () => {
  describe('addReaction', () => {
    it('should call createForIssueComment with correct parameters', async () => {
      let called = false;
      const octokit = {
        rest: {
          reactions: {
            createForIssueComment: async (params: unknown) => {
              called = true;
              expect(params).toEqual({
                owner: 'test-owner',
                repo: 'test-repo',
                comment_id: 999,
                content: 'eyes',
              });
              return {};
            },
          },
        },
      } as unknown as Octokit;

      await addReaction(octokit, 'test-owner', 'test-repo', 999, 'eyes');
      expect(called).toBe(true);
    });

    it('should swallow errors silently', async () => {
      const octokit = {
        rest: {
          reactions: {
            createForIssueComment: async () => {
              throw new Error('API Error');
            },
          },
        },
      } as unknown as Octokit;

      // Should not throw
      await expect(addReaction(octokit, 'test-owner', 'test-repo', 999, 'eyes')).resolves.toBeUndefined();
    });
  });

  describe('postComment', () => {
    it('should call createComment with correct parameters', async () => {
      let called = false;
      const octokit = {
        rest: {
          issues: {
            createComment: async (params: unknown) => {
              called = true;
              expect(params).toEqual({
                owner: 'test-owner',
                repo: 'test-repo',
                issue_number: 123,
                body: 'Test comment',
              });
              return {};
            },
          },
        },
      } as unknown as Octokit;

      await postComment(octokit, 'test-owner', 'test-repo', 123, 'Test comment');
      expect(called).toBe(true);
    });
  });

  describe('getCollaboratorPermission', () => {
    it('should return permission level', async () => {
      const octokit = {
        rest: {
          repos: {
            getCollaboratorPermissionLevel: async () => ({
              data: { permission: 'write' },
            }),
          },
        },
      } as unknown as Octokit;

      const result = await getCollaboratorPermission(octokit, 'test-owner', 'test-repo', 'testuser');
      expect(result).toBe('write');
    });

    it('should return none on error', async () => {
      const octokit = {
        rest: {
          repos: {
            getCollaboratorPermissionLevel: async () => {
              throw new Error('API Error');
            },
          },
        },
      } as unknown as Octokit;

      const result = await getCollaboratorPermission(octokit, 'test-owner', 'test-repo', 'testuser');
      expect(result).toBe('none');
    });
  });

  describe('fetchPullRequestData', () => {
    it('should return formatted PR data', async () => {
      const octokit = createMockOctokit();
      const result = await fetchPullRequestData(octokit, 'test-owner', 'test-repo', 123);

      expect(result).toMatchObject({
        state: 'open',
        locked: false,
        draft: false,
        merged: false,
        mergeable: true,
        mergeableState: 'clean',
        headRef: 'feature/test',
        baseRef: 'develop',
        author: 'testuser',
        isFork: false,
        title: 'feat: test pull request',
      });
    });

    it('should detect fork repository', async () => {
      const octokit = {
        rest: {
          pulls: {
            get: async () => ({
              data: {
                state: 'open',
                locked: false,
                draft: false,
                merged: false,
                mergeable: true,
                mergeable_state: 'clean',
                head: {
                  sha: 'abc123',
                  ref: 'feature/test',
                  repo: { fork: true, owner: { id: 2 } },
                },
                base: {
                  ref: 'develop',
                  repo: { owner: { id: 1 } },
                },
                user: { login: 'testuser' },
                title: 'Test PR',
              },
            }),
          },
        },
      } as unknown as Octokit;

      const result = await fetchPullRequestData(octokit, 'test-owner', 'test-repo', 123);
      expect(result.isFork).toBe(true);
    });
  });

  describe('fetchApprovedReviews', () => {
    it('should return only approved reviews', async () => {
      const octokit = {
        rest: {
          pulls: {
            listReviews: {} as unknown,
          },
        },
        paginate: async () => [
          { id: 1, state: 'APPROVED', user: { login: 'user1' } },
          { id: 2, state: 'CHANGES_REQUESTED', user: { login: 'user2' } },
          { id: 3, state: 'APPROVED', user: { login: 'user3' } },
        ],
      } as unknown as Octokit;

      const result = await fetchApprovedReviews(octokit, 'test-owner', 'test-repo', 123);
      expect(result).toHaveLength(2);
      expect(result[0]!.state).toBe('APPROVED');
      expect(result[1]!.state).toBe('APPROVED');
    });
  });

  describe('dismissReview', () => {
    it('should return true on success', async () => {
      const octokit = {
        rest: {
          pulls: {
            dismissReview: async () => ({}),
          },
        },
      } as unknown as Octokit;

      const result = await dismissReview(octokit, 'test-owner', 'test-repo', 123, 456, 'Test message');
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      const octokit = {
        rest: {
          pulls: {
            dismissReview: async () => {
              throw new Error('API Error');
            },
          },
        },
      } as unknown as Octokit;

      const result = await dismissReview(octokit, 'test-owner', 'test-repo', 123, 456, 'Test message');
      expect(result).toBe(false);
    });
  });

  describe('countUnresolvedThreads', () => {
    it('should count unresolved threads', async () => {
      const octokit = {
        graphql: async () => ({
          repository: {
            pullRequest: {
              reviewThreads: {
                pageInfo: { hasNextPage: false, endCursor: null },
                nodes: [{ isResolved: false }, { isResolved: true }, { isResolved: false }],
              },
            },
          },
        }),
      } as unknown as Octokit;

      const result = await countUnresolvedThreads(octokit, 'test-owner', 'test-repo', 123);
      expect(result).toBe(2);
    });

    it('should handle pagination', async () => {
      let callCount = 0;
      const octokit = {
        graphql: async () => {
          callCount++;
          if (callCount === 1) {
            return {
              repository: {
                pullRequest: {
                  reviewThreads: {
                    pageInfo: { hasNextPage: true, endCursor: 'cursor1' },
                    nodes: [{ isResolved: false }, { isResolved: false }],
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
                  nodes: [{ isResolved: false }, { isResolved: true }],
                },
              },
            },
          };
        },
      } as unknown as Octokit;

      const result = await countUnresolvedThreads(octokit, 'test-owner', 'test-repo', 123);
      expect(result).toBe(3);
      expect(callCount).toBe(2);
    });
  });

  describe('fetchPullRequestCommits', () => {
    it('should return commits', async () => {
      const octokit = {
        rest: {
          pulls: {
            listCommits: {} as unknown,
          },
        },
        paginate: async () => [
          { commit: { message: 'Commit 1', author: { name: 'User 1', email: 'user1@test.com' } } },
          { commit: { message: 'Commit 2', author: { name: 'User 2', email: 'user2@test.com' } } },
        ],
      } as unknown as Octokit;

      const result = await fetchPullRequestCommits(octokit, 'test-owner', 'test-repo', 123);
      expect(result).toHaveLength(2);
      expect(result[0]!.commit.message).toBe('Commit 1');
      expect(result[1]!.commit.message).toBe('Commit 2');
    });
  });

  describe('mergePullRequest', () => {
    it('should return success on successful merge', async () => {
      const octokit = {
        rest: {
          pulls: {
            merge: async () => ({
              data: { sha: 'merge123' },
            }),
          },
        },
      } as unknown as Octokit;

      const result = await mergePullRequest(
        octokit,
        'test-owner',
        'test-repo',
        123,
        'squash',
        'abc123',
        'Test title',
        'Test message',
      );
      expect(result.success).toBe(true);
      expect(result.mergeCommitSha).toBe('merge123');
    });

    it('should return error on failure', async () => {
      const octokit = {
        rest: {
          pulls: {
            merge: async () => {
              throw new Error('Merge conflict');
            },
          },
        },
      } as unknown as Octokit;

      const result = await mergePullRequest(
        octokit,
        'test-owner',
        'test-repo',
        123,
        'squash',
        'abc123',
        'Test title',
        'Test message',
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('Merge conflict');
    });
  });
});
