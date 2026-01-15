import { describe, expect, it } from 'vitest';

import { DefaultMergeService } from '../../../../src/modules/merge/internal/default-merge-service.js';
import type { Octokit, Review } from '../../../../src/modules/merge/internal/types.js';
import { createMockConfig, createMockEventContext, createMockPullRequestData } from '../../../helpers/fixtures.js';

describe('DefaultMergeService', () => {
  const service = new DefaultMergeService();

  describe('executeAction - skipped cases', () => {
    it('should skip when event is not issue_comment', async () => {
      const context = createMockEventContext({ eventName: 'push' });
      const config = createMockConfig();
      const octokit = {} as Octokit;

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('skipped');
      expect(result.message).toBe('This action only runs on issue_comment events');
    });

    it('should skip when not on a pull request', async () => {
      const context = createMockEventContext({ isPullRequest: false });
      const config = createMockConfig();
      const octokit = {} as Octokit;

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('skipped');
      expect(result.message).toBe('Comment is not on a PR, skipping');
    });

    it('should skip when comment is from a bot', async () => {
      const context = createMockEventContext({ userType: 'Bot' });
      const config = createMockConfig();
      const octokit = {} as Octokit;

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('skipped');
      expect(result.message).toBe('Comment is from a bot');
    });

    it('should skip when command does not match', async () => {
      const context = createMockEventContext({ commentBody: 'not a command' });
      const config = createMockConfig();
      const octokit = {} as Octokit;

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('skipped');
      expect(result.message).toBe('Command not matched');
    });

    it('should skip when invalid flag is provided', async () => {
      const context = createMockEventContext({ commentBody: '/lysbot merge --invalid-flag' });
      const config = createMockConfig();
      const octokit = {} as Octokit;

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('skipped');
      expect(result.message).toBe('Command not matched');
    });
  });

  describe('executeAction - permission checks', () => {
    it('should fail when author association is invalid', async () => {
      const context = createMockEventContext({ authorAssociation: 'CONTRIBUTOR' });
      const config = createMockConfig();
      const comments: string[] = [];
      const octokit = {
        rest: {
          reactions: {
            createForIssueComment: async () => ({}),
          },
          issues: {
            createComment: async (params: { body: string }) => {
              comments.push(params.body);
              return {};
            },
          },
        },
      } as unknown as Octokit;

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toBe('Invalid author association');
      expect(comments).toHaveLength(1);
      expect(comments[0]).toContain('Permission denied');
      expect(comments[0]).toContain('CONTRIBUTOR');
    });

    it('should fail when user has insufficient permissions', async () => {
      const context = createMockEventContext({ authorAssociation: 'MEMBER' });
      const config = createMockConfig();
      const comments: string[] = [];
      const octokit = {
        rest: {
          reactions: {
            createForIssueComment: async () => ({}),
          },
          issues: {
            createComment: async (params: { body: string }) => {
              comments.push(params.body);
              return {};
            },
          },
          repos: {
            getCollaboratorPermissionLevel: async () => ({
              data: { permission: 'read' },
            }),
          },
        },
      } as unknown as Octokit;

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toBe('Insufficient permissions');
      expect(comments).toHaveLength(1);
      expect(comments[0]).toContain('Permission denied');
      expect(comments[0]).toContain('read');
    });
  });

  describe('executeAction - fork PRs', () => {
    it('should fail when PR is from a fork', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData({ isFork: true });
      const comments: string[] = [];
      const octokit = {
        rest: {
          reactions: {
            createForIssueComment: async () => ({}),
          },
          issues: {
            createComment: async (params: { body: string }) => {
              comments.push(params.body);
              return {};
            },
          },
          repos: {
            getCollaboratorPermissionLevel: async () => ({
              data: { permission: 'write' },
            }),
          },
          pulls: {
            get: async () => ({
              data: {
                state: prData.state,
                locked: prData.locked,
                draft: prData.draft,
                merged: prData.merged,
                mergeable: prData.mergeable,
                mergeable_state: prData.mergeableState,
                head: {
                  sha: prData.headSha,
                  ref: prData.headRef,
                  repo: { fork: true, owner: { id: 2 } },
                },
                base: {
                  ref: prData.baseRef,
                  repo: { owner: { id: 1 } },
                },
                user: { login: prData.author },
                title: prData.title,
              },
            }),
          },
        },
      } as unknown as Octokit;

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toBe('Fork PR not supported');
      expect(comments).toHaveLength(1);
      expect(comments[0]).toContain('Fork PR not supported');
    });
  });

  describe('executeAction - already merged PR', () => {
    it('should return already_merged when PR is already merged', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData({ merged: true });
      const comments: string[] = [];
      const octokit = {
        rest: {
          reactions: {
            createForIssueComment: async () => ({}),
          },
          issues: {
            createComment: async (params: { body: string }) => {
              comments.push(params.body);
              return {};
            },
          },
          repos: {
            getCollaboratorPermissionLevel: async () => ({
              data: { permission: 'write' },
            }),
          },
          pulls: {
            get: async () => ({
              data: {
                state: prData.state,
                locked: prData.locked,
                draft: prData.draft,
                merged: prData.merged,
                mergeable: prData.mergeable,
                mergeable_state: prData.mergeableState,
                head: {
                  sha: prData.headSha,
                  ref: prData.headRef,
                  repo: { fork: false, owner: { id: 1 } },
                },
                base: {
                  ref: prData.baseRef,
                  repo: { owner: { id: 1 } },
                },
                user: { login: prData.author },
                title: prData.title,
              },
            }),
          },
        },
      } as unknown as Octokit;

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('already_merged');
      expect(result.message).toBe('PR already merged');
      expect(comments).toHaveLength(1);
      expect(comments[0]).toContain('Already merged');
    });
  });

  describe('executeAction - PR state validation', () => {
    it('should fail when PR is closed', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData({ state: 'closed' });
      const comments: string[] = [];
      const octokit = createOctokitForValidation(prData, comments, [], 0);

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toBe('Merge checks failed');
      expect(comments).toHaveLength(1);
      expect(comments[0]).toContain('Merge checks failed');
      expect(comments[0]).toContain('currently closed');
    });

    it('should fail when PR is locked', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData({ locked: true });
      const comments: string[] = [];
      const octokit = createOctokitForValidation(prData, comments, [], 0);

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toBe('Merge checks failed');
      expect(comments[0]).toContain('currently locked');
    });

    it('should fail when PR is a draft', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData({ draft: true });
      const comments: string[] = [];
      const octokit = createOctokitForValidation(prData, comments, [], 0);

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toBe('Merge checks failed');
      expect(comments[0]).toContain('currently a draft');
    });
  });

  describe('executeAction - unresolved review threads', () => {
    it('should fail when there are unresolved threads', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData();
      const comments: string[] = [];
      const octokit = createOctokitForValidation(prData, comments, [], 3);

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toBe('Merge checks failed');
      expect(comments[0]).toContain('3 unresolved');
    });
  });

  describe('executeAction - approval handling', () => {
    it('should fail when there are no approvals', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData();
      const comments: string[] = [];
      const octokit = createOctokitForValidation(prData, comments, [], 0);

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toBe('Merge checks failed');
      expect(comments[0]).toContain('no valid approvals found');
    });

    it('should dismiss stale approvals and fail when no valid approvals remain', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData({ headSha: 'newsha123' });
      const comments: string[] = [];
      const reviews: Review[] = [
        {
          id: 1,
          state: 'APPROVED',
          commit_id: 'oldsha456',
          user: { login: 'reviewer1' },
        } as Review,
      ];
      const dismissedReviews: number[] = [];
      const octokit = createOctokitForValidation(prData, comments, reviews, 0, dismissedReviews);

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toBe('Merge checks failed');
      expect(dismissedReviews).toEqual([1]);
      expect(comments[0]).toContain('no valid approvals found');
    });

    it('should post warning when failing to dismiss stale approvals', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData({ headSha: 'newsha123' });
      const comments: string[] = [];
      const reviews: Review[] = [
        {
          id: 1,
          state: 'APPROVED',
          commit_id: 'oldsha456',
          user: { login: 'reviewer1' },
        } as Review,
      ];
      const octokit = createOctokitForValidation(prData, comments, reviews, 0, undefined, true);

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toBe('Merge checks failed');
      const dismissFailureComment = comments.find((c) => c.includes('Stale approval dismiss failures'));
      expect(dismissFailureComment).toBeDefined();
      expect(dismissFailureComment).toContain('reviewer1');
    });

    it('should ignore approvals from PR author', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData({ author: 'testuser' });
      const comments: string[] = [];
      const reviews: Review[] = [
        {
          id: 1,
          state: 'APPROVED',
          commit_id: prData.headSha,
          user: { login: 'testuser' },
        } as Review,
      ];
      const octokit = createOctokitForValidation(prData, comments, reviews, 0);

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toBe('Merge checks failed');
      expect(comments[0]).toContain('no valid approvals found');
    });

    it('should pass with valid approvals', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData();
      const comments: string[] = [];
      const reviews: Review[] = [
        {
          id: 1,
          state: 'APPROVED',
          commit_id: prData.headSha,
          user: { login: 'reviewer1' },
        } as Review,
      ];
      const octokit = createOctokitForSuccessfulMerge(prData, comments, reviews, 0);

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('merged');
      expect(result.message).toBe('PR merged successfully');
    });

    it('should override approval requirement with flag', async () => {
      const context = createMockEventContext({
        commentBody: '/lysbot merge --override-approval-requirement',
      });
      const config = createMockConfig();
      const prData = createMockPullRequestData();
      const comments: string[] = [];
      const mergeDetails = { method: '', title: '', body: '' };
      const octokit = createOctokitForSuccessfulMerge(prData, comments, [], 0, mergeDetails);

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('merged');
      expect(result.message).toBe('PR merged successfully');
      const passedComment = comments.find((c) => c.includes('Merge checks passed'));
      expect(passedComment).toContain('approval requirement overridden');
      expect(mergeDetails.body).toContain('EXCEPTIONAL MERGE');
    });
  });

  describe('executeAction - merge conflicts', () => {
    it('should fail when there are merge conflicts', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData({ mergeableState: 'dirty' });
      const comments: string[] = [];
      const reviews: Review[] = [
        {
          id: 1,
          state: 'APPROVED',
          commit_id: prData.headSha,
          user: { login: 'reviewer1' },
        } as Review,
      ];
      const octokit = createOctokitForValidation(prData, comments, reviews, 0);

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toBe('Merge checks failed');
      expect(comments[0]).toContain('has unresolved conflicts');
    });

    it('should fail when mergeableState is blocked', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData({ mergeableState: 'blocked' });
      const comments: string[] = [];
      const reviews: Review[] = [
        {
          id: 1,
          state: 'APPROVED',
          commit_id: prData.headSha,
          user: { login: 'reviewer1' },
        } as Review,
      ];
      const octokit = createOctokitForValidation(prData, comments, reviews, 0);

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toBe('Merge checks failed');
      expect(comments[0]).toContain('blocked by status checks');
    });
  });

  describe('executeAction - conventional commit validation', () => {
    it('should show warning when title is not conventional', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData({ title: 'Not a conventional title' });
      const comments: string[] = [];
      const reviews: Review[] = [
        {
          id: 1,
          state: 'APPROVED',
          commit_id: prData.headSha,
          user: { login: 'reviewer1' },
        } as Review,
      ];
      const octokit = createOctokitForSuccessfulMerge(prData, comments, reviews, 0);

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('merged');
      expect(result.message).toBe('PR merged successfully');
      const passedComment = comments.find((c) => c.includes('Merge checks passed'));
      expect(passedComment).toContain('title does not follow conventional format');
    });
  });

  describe('executeAction - merge method determination', () => {
    it('should use squash merge for feature branch to develop', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData({ headRef: 'feature/test', baseRef: 'develop' });
      const comments: string[] = [];
      const reviews: Review[] = [
        {
          id: 1,
          state: 'APPROVED',
          commit_id: prData.headSha,
          user: { login: 'reviewer1' },
        } as Review,
      ];
      const mergeDetails = { method: '', title: '', body: '' };
      const octokit = createOctokitForSuccessfulMerge(prData, comments, reviews, 0, mergeDetails);

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('merged');
      expect(result.mergeMethod).toBe('squash');
      expect(mergeDetails.method).toBe('squash');
    });

    it('should use merge commit for release branch', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData({ headRef: 'release/1.0.0', baseRef: 'main' });
      const comments: string[] = [];
      const reviews: Review[] = [
        {
          id: 1,
          state: 'APPROVED',
          commit_id: prData.headSha,
          user: { login: 'reviewer1' },
        } as Review,
      ];
      const mergeDetails = { method: '', title: '', body: '' };
      const octokit = createOctokitForSuccessfulMerge(prData, comments, reviews, 0, mergeDetails);

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('merged');
      expect(result.mergeMethod).toBe('merge');
      expect(mergeDetails.method).toBe('merge');
    });

    it('should use merge commit for sync branch', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData({ headRef: 'fix/sync/main-to-develop', baseRef: 'develop' });
      const comments: string[] = [];
      const reviews: Review[] = [
        {
          id: 1,
          state: 'APPROVED',
          commit_id: prData.headSha,
          user: { login: 'reviewer1' },
        } as Review,
      ];
      const mergeDetails = { method: '', title: '', body: '' };
      const octokit = createOctokitForSuccessfulMerge(prData, comments, reviews, 0, mergeDetails);

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('merged');
      expect(result.mergeMethod).toBe('merge');
      expect(mergeDetails.method).toBe('merge');
    });

    it('should use squash merge when base is release branch', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData({ headRef: 'hotfix/bug', baseRef: 'release/1.0.0' });
      const comments: string[] = [];
      const reviews: Review[] = [
        {
          id: 1,
          state: 'APPROVED',
          commit_id: prData.headSha,
          user: { login: 'reviewer1' },
        } as Review,
      ];
      const mergeDetails = { method: '', title: '', body: '' };
      const octokit = createOctokitForSuccessfulMerge(prData, comments, reviews, 0, mergeDetails);

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('merged');
      expect(result.mergeMethod).toBe('squash');
      expect(mergeDetails.method).toBe('squash');
    });
  });

  describe('executeAction - TOCTOU violations', () => {
    it('should fail when new commits are detected before merge', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData({ headSha: 'originalsha' });
      const comments: string[] = [];
      const reviews: Review[] = [
        {
          id: 1,
          state: 'APPROVED',
          commit_id: prData.headSha,
          user: { login: 'reviewer1' },
        } as Review,
      ];
      let callCount = 0;
      const octokit = {
        rest: {
          reactions: {
            createForIssueComment: async () => ({}),
          },
          issues: {
            createComment: async (params: { body: string }) => {
              comments.push(params.body);
              return {};
            },
          },
          repos: {
            getCollaboratorPermissionLevel: async () => ({
              data: { permission: 'write' },
            }),
          },
          pulls: {
            get: async () => {
              callCount++;
              const currentSha = callCount === 1 ? 'originalsha' : 'newsha123';
              return {
                data: {
                  state: prData.state,
                  locked: prData.locked,
                  draft: prData.draft,
                  merged: prData.merged,
                  mergeable: prData.mergeable,
                  mergeable_state: prData.mergeableState,
                  head: {
                    sha: currentSha,
                    ref: prData.headRef,
                    repo: { fork: false, owner: { id: 1 } },
                  },
                  base: {
                    ref: prData.baseRef,
                    repo: { owner: { id: 1 } },
                  },
                  user: { login: prData.author },
                  title: prData.title,
                },
              };
            },
          },
        },
        paginate: async () => reviews,
        graphql: async () => ({
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

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toBe('TOCTOU violation');
      const toctouComment = comments.find((c) => c.includes('New commits detected'));
      expect(toctouComment).toBeDefined();
      expect(toctouComment).toContain('originalsha');
      expect(toctouComment).toContain('newsha123');
    });

    it('should fail when new commits are detected during mergeable retry', async () => {
      const context = createMockEventContext();
      const config = createMockConfig({ mergeableRetryCount: 2, mergeableRetryInterval: 0 });
      const prData = createMockPullRequestData({ headSha: 'originalsha', mergeable: null });
      const comments: string[] = [];
      const reviews: Review[] = [
        {
          id: 1,
          state: 'APPROVED',
          commit_id: prData.headSha,
          user: { login: 'reviewer1' },
        } as Review,
      ];
      let callCount = 0;
      const octokit = {
        rest: {
          reactions: {
            createForIssueComment: async () => ({}),
          },
          issues: {
            createComment: async (params: { body: string }) => {
              comments.push(params.body);
              return {};
            },
          },
          repos: {
            getCollaboratorPermissionLevel: async () => ({
              data: { permission: 'write' },
            }),
          },
          pulls: {
            get: async () => {
              callCount++;
              const currentSha = callCount <= 2 ? 'originalsha' : 'newsha456';
              return {
                data: {
                  state: prData.state,
                  locked: prData.locked,
                  draft: prData.draft,
                  merged: prData.merged,
                  mergeable: null,
                  mergeable_state: prData.mergeableState,
                  head: {
                    sha: currentSha,
                    ref: prData.headRef,
                    repo: { fork: false, owner: { id: 1 } },
                  },
                  base: {
                    ref: prData.baseRef,
                    repo: { owner: { id: 1 } },
                  },
                  user: { login: prData.author },
                  title: prData.title,
                },
              };
            },
          },
        },
        paginate: async () => reviews,
        graphql: async () => ({
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

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toBe('TOCTOU violation during retry');
      const toctouComment = comments.find(
        (c) => c.includes('New commits detected') && c.includes('after waiting for mergeable status'),
      );
      expect(toctouComment).toBeDefined();
    });
  });

  describe('executeAction - mergeable status pending', () => {
    it('should fail when mergeable status remains null after retries', async () => {
      const context = createMockEventContext();
      const config = createMockConfig({ mergeableRetryCount: 2, mergeableRetryInterval: 0 });
      const prData = createMockPullRequestData({ mergeable: null });
      const comments: string[] = [];
      const reviews: Review[] = [
        {
          id: 1,
          state: 'APPROVED',
          commit_id: prData.headSha,
          user: { login: 'reviewer1' },
        } as Review,
      ];
      const octokit = {
        rest: {
          reactions: {
            createForIssueComment: async () => ({}),
          },
          issues: {
            createComment: async (params: { body: string }) => {
              comments.push(params.body);
              return {};
            },
          },
          repos: {
            getCollaboratorPermissionLevel: async () => ({
              data: { permission: 'write' },
            }),
          },
          pulls: {
            get: async () => ({
              data: {
                state: prData.state,
                locked: prData.locked,
                draft: prData.draft,
                merged: prData.merged,
                mergeable: null,
                mergeable_state: prData.mergeableState,
                head: {
                  sha: prData.headSha,
                  ref: prData.headRef,
                  repo: { fork: false, owner: { id: 1 } },
                },
                base: {
                  ref: prData.baseRef,
                  repo: { owner: { id: 1 } },
                },
                user: { login: prData.author },
                title: prData.title,
              },
            }),
          },
        },
        paginate: async () => reviews,
        graphql: async () => ({
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

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toBe('Not mergeable');
      const pendingComment = comments.find((c) => c.includes('Mergeability status pending'));
      expect(pendingComment).toBeDefined();
      expect(pendingComment).toContain('null');
    });

    it('should fail when mergeable is false with non-dirty state', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData();
      const comments: string[] = [];
      const reviews: Review[] = [
        {
          id: 1,
          state: 'APPROVED',
          commit_id: prData.headSha,
          user: { login: 'reviewer1' },
        } as Review,
      ];
      let callCount = 0;
      const mockRest = {
        reactions: {
          createForIssueComment: async () => ({}),
        },
        issues: {
          createComment: async (params: { body: string }) => {
            comments.push(params.body);
            return {};
          },
        },
        repos: {
          getCollaboratorPermissionLevel: async () => ({
            data: { permission: 'write' },
          }),
        },
        pulls: {
          get: async () => {
            callCount++;
            const mergeable = callCount === 1 ? true : false;
            const mergeableState = callCount === 1 ? 'clean' : 'blocked';
            return {
              data: {
                state: prData.state,
                locked: prData.locked,
                draft: prData.draft,
                merged: prData.merged,
                mergeable,
                mergeable_state: mergeableState,
                head: {
                  sha: prData.headSha,
                  ref: prData.headRef,
                  repo: { fork: false, owner: { id: 1 } },
                },
                base: {
                  ref: prData.baseRef,
                  repo: { owner: { id: 1 } },
                },
                user: { login: prData.author },
                title: prData.title,
              },
            };
          },
          listReviews: async () => ({ data: reviews }),
          listCommits: async () => ({ data: [] }),
        },
      };
      const octokit = {
        rest: mockRest,
        paginate: async (endpoint: unknown) => {
          if (endpoint === mockRest.pulls.listReviews) {
            return reviews;
          }
          if (endpoint === mockRest.pulls.listCommits) {
            return [];
          }
          return [];
        },
        graphql: async () => ({
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

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toBe('Not mergeable');
      const cannotMergeComment = comments.find((c) => c.includes('Cannot merge'));
      expect(cannotMergeComment).toBeDefined();
      expect(cannotMergeComment).toContain('blocked');
    });

    it('should fail when mergeable is false after checks pass', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData();
      const comments: string[] = [];
      const reviews: Review[] = [
        {
          id: 1,
          state: 'APPROVED',
          commit_id: prData.headSha,
          user: { login: 'reviewer1' },
        } as Review,
      ];
      let callCount = 0;
      const mockRest = {
        reactions: {
          createForIssueComment: async () => ({}),
        },
        issues: {
          createComment: async (params: { body: string }) => {
            comments.push(params.body);
            return {};
          },
        },
        repos: {
          getCollaboratorPermissionLevel: async () => ({
            data: { permission: 'write' },
          }),
        },
        pulls: {
          get: async () => {
            callCount++;
            // Call 1: Initial PR data fetch - pass
            // Call 2: Re-fetch after checks pass (TOCTOU check) - becomes false
            const mergeable = callCount === 1 ? true : false;
            const mergeableState = callCount === 1 ? 'clean' : 'dirty';
            return {
              data: {
                state: prData.state,
                locked: prData.locked,
                draft: prData.draft,
                merged: prData.merged,
                mergeable,
                mergeable_state: mergeableState,
                head: {
                  sha: prData.headSha,
                  ref: prData.headRef,
                  repo: { fork: false, owner: { id: 1 } },
                },
                base: {
                  ref: prData.baseRef,
                  repo: { owner: { id: 1 } },
                },
                user: { login: prData.author },
                title: prData.title,
              },
            };
          },
          listReviews: async () => ({ data: reviews }),
          listCommits: async () => ({ data: [] }),
        },
      };
      const octokit = {
        rest: mockRest,
        paginate: async (endpoint: unknown) => {
          if (endpoint === mockRest.pulls.listReviews) {
            return reviews;
          }
          if (endpoint === mockRest.pulls.listCommits) {
            return [];
          }
          return [];
        },
        graphql: async () => ({
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

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toBe('Not mergeable');
      const conflictsComment = comments.find((c) => c.includes('Conflicts detected'));
      expect(conflictsComment).toBeDefined();
    });
  });

  describe('executeAction - merge failures', () => {
    it('should fail when merge API call fails', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData();
      const comments: string[] = [];
      const reviews: Review[] = [
        {
          id: 1,
          state: 'APPROVED',
          commit_id: prData.headSha,
          user: { login: 'reviewer1' },
        } as Review,
      ];
      const mockRest = {
        reactions: {
          createForIssueComment: async () => ({}),
        },
        issues: {
          createComment: async (params: { body: string }) => {
            comments.push(params.body);
            return {};
          },
        },
        repos: {
          getCollaboratorPermissionLevel: async () => ({
            data: { permission: 'write' },
          }),
        },
        pulls: {
          get: async () => ({
            data: {
              state: prData.state,
              locked: prData.locked,
              draft: prData.draft,
              merged: prData.merged,
              mergeable: prData.mergeable,
              mergeable_state: prData.mergeableState,
              head: {
                sha: prData.headSha,
                ref: prData.headRef,
                repo: { fork: false, owner: { id: 1 } },
              },
              base: {
                ref: prData.baseRef,
                repo: { owner: { id: 1 } },
              },
              user: { login: prData.author },
              title: prData.title,
            },
          }),
          listReviews: async () => ({ data: reviews }),
          listCommits: async () => ({ data: [] }),
          merge: async () => {
            throw new Error('Merge conflict detected');
          },
        },
      };
      const octokit = {
        rest: mockRest,
        paginate: async (endpoint: unknown) => {
          if (endpoint === mockRest.pulls.listReviews) {
            return reviews;
          }
          if (endpoint === mockRest.pulls.listCommits) {
            return [];
          }
          return [];
        },
        graphql: async () => ({
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

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('Merge failed');
      const failedComment = comments.find((c) => c.includes('Merge failed'));
      expect(failedComment).toBeDefined();
      expect(failedComment).toContain('Merge conflict detected');
    });
  });

  describe('executeAction - successful merge', () => {
    it('should successfully merge with squash method', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData({ headRef: 'feature/test', baseRef: 'develop' });
      const comments: string[] = [];
      const reviews: Review[] = [
        {
          id: 1,
          state: 'APPROVED',
          commit_id: prData.headSha,
          user: { login: 'reviewer1' },
        } as Review,
      ];
      const mergeDetails = { method: '', title: '', body: '' };
      const octokit = createOctokitForSuccessfulMerge(prData, comments, reviews, 0, mergeDetails);

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('merged');
      expect(result.message).toBe('PR merged successfully');
      expect(result.mergeMethod).toBe('squash');
      expect(mergeDetails.method).toBe('squash');
      expect(mergeDetails.title).toContain(prData.title);
      expect(mergeDetails.title).toContain('#123');
      expect(mergeDetails.body).toContain('Merged-by: lysbot-merge');
      expect(mergeDetails.body).toContain('test-actor');

      const passedComment = comments.find((c) => c.includes('Merge checks passed'));
      expect(passedComment).toBeDefined();

      const successComment = comments.find((c) => c.includes('Merged by lysbot-merge'));
      expect(successComment).toBeDefined();
      expect(successComment).toContain('squash');
      expect(successComment).toContain(prData.headSha);
      expect(successComment).toContain('merge123456789');
    });

    it('should successfully merge with merge method and include commit titles', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData({ headRef: 'release/1.0.0', baseRef: 'main' });
      const comments: string[] = [];
      const reviews: Review[] = [
        {
          id: 1,
          state: 'APPROVED',
          commit_id: prData.headSha,
          user: { login: 'reviewer1' },
        } as Review,
      ];
      const mergeDetails = { method: '', title: '', body: '' };
      const commits = [
        {
          commit: {
            message: 'feat: add feature A',
            author: { name: 'Author 1', email: 'author1@example.com' },
          },
        },
        {
          commit: {
            message: 'fix: fix bug B',
            author: { name: 'Author 2', email: 'author2@example.com' },
          },
        },
      ];
      const octokit = createOctokitForSuccessfulMerge(prData, comments, reviews, 0, mergeDetails, commits);

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('merged');
      expect(result.message).toBe('PR merged successfully');
      expect(result.mergeMethod).toBe('merge');
      expect(mergeDetails.method).toBe('merge');
      expect(mergeDetails.title).toContain('Merge pull request #123');
      expect(mergeDetails.title).toContain('release/1.0.0');
      expect(mergeDetails.body).toContain('Merged-by: lysbot-merge');
    });

    it('should include co-authors in squash merge body', async () => {
      const context = createMockEventContext();
      const config = createMockConfig();
      const prData = createMockPullRequestData({ headRef: 'feature/test', baseRef: 'develop' });
      const comments: string[] = [];
      const reviews: Review[] = [
        {
          id: 1,
          state: 'APPROVED',
          commit_id: prData.headSha,
          user: { login: 'reviewer1' },
        } as Review,
      ];
      const mergeDetails = { method: '', title: '', body: '' };
      const commits = [
        {
          commit: {
            message: 'feat: add feature',
            author: { name: 'Author 1', email: 'author1@example.com' },
          },
        },
        {
          commit: {
            message: 'fix: fix bug',
            author: { name: 'Author 2', email: 'author2@example.com' },
          },
        },
      ];
      const octokit = createOctokitForSuccessfulMerge(prData, comments, reviews, 0, mergeDetails, commits);

      const result = await service.executeAction(octokit, context, config);

      expect(result.status).toBe('merged');
      expect(mergeDetails.body).toContain('Co-authored-by: Author 1 <author1@example.com>');
      expect(mergeDetails.body).toContain('Co-authored-by: Author 2 <author2@example.com>');
    });
  });
});

// Helper functions to create Octokit mocks for different scenarios

function createOctokitForValidation(
  prData: ReturnType<typeof createMockPullRequestData>,
  comments: string[],
  reviews: Review[],
  unresolvedThreads: number,
  dismissedReviews?: number[],
  dismissFailure = false,
): Octokit {
  return {
    rest: {
      reactions: {
        createForIssueComment: async () => ({}),
      },
      issues: {
        createComment: async (params: { body: string }) => {
          comments.push(params.body);
          return {};
        },
      },
      repos: {
        getCollaboratorPermissionLevel: async () => ({
          data: { permission: 'write' },
        }),
      },
      pulls: {
        get: async () => ({
          data: {
            state: prData.state,
            locked: prData.locked,
            draft: prData.draft,
            merged: prData.merged,
            mergeable: prData.mergeable,
            mergeable_state: prData.mergeableState,
            head: {
              sha: prData.headSha,
              ref: prData.headRef,
              repo: { fork: false, owner: { id: 1 } },
            },
            base: {
              ref: prData.baseRef,
              repo: { owner: { id: 1 } },
            },
            user: { login: prData.author },
            title: prData.title,
          },
        }),
        dismissReview: async (params: { review_id: number }) => {
          if (dismissFailure) {
            throw new Error('Dismiss failed');
          }
          if (dismissedReviews) {
            dismissedReviews.push(params.review_id);
          }
          return {};
        },
      },
    },
    paginate: async () => reviews,
    graphql: async () => ({
      repository: {
        pullRequest: {
          reviewThreads: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: Array(unresolvedThreads)
              .fill(null)
              .map(() => ({ isResolved: false })),
          },
        },
      },
    }),
  } as unknown as Octokit;
}

function createOctokitForSuccessfulMerge(
  prData: ReturnType<typeof createMockPullRequestData>,
  comments: string[],
  reviews: Review[],
  unresolvedThreads: number,
  mergeDetails?: { method: string; title?: string; body?: string },
  commits: Array<{ commit: { message: string; author?: { name?: string; email?: string } } }> = [],
): Octokit {
  const mockRest = {
    reactions: {
      createForIssueComment: async () => ({}),
    },
    issues: {
      createComment: async (params: { body: string }) => {
        comments.push(params.body);
        return {};
      },
    },
    repos: {
      getCollaboratorPermissionLevel: async () => ({
        data: { permission: 'write' },
      }),
    },
    pulls: {
      get: async () => ({
        data: {
          state: prData.state,
          locked: prData.locked,
          draft: prData.draft,
          merged: prData.merged,
          mergeable: prData.mergeable,
          mergeable_state: prData.mergeableState,
          head: {
            sha: prData.headSha,
            ref: prData.headRef,
            repo: { fork: false, owner: { id: 1 } },
          },
          base: {
            ref: prData.baseRef,
            repo: { owner: { id: 1 } },
          },
          user: { login: prData.author },
          title: prData.title,
        },
      }),
      listCommits: async () => ({ data: commits }),
      listReviews: async () => ({ data: reviews }),
      merge: async (params: { merge_method: string; commit_title: string; commit_message: string }) => {
        if (mergeDetails) {
          mergeDetails.method = params.merge_method;
          mergeDetails.title = params.commit_title;
          mergeDetails.body = params.commit_message;
        }
        return {
          data: { sha: 'merge123456789', merged: true, message: 'Pull request successfully merged' },
        };
      },
    },
  };

  return {
    rest: mockRest,
    paginate: async (endpoint: unknown) => {
      if (endpoint === mockRest.pulls.listReviews) {
        return reviews;
      }
      if (endpoint === mockRest.pulls.listCommits) {
        return commits;
      }
      return [];
    },
    graphql: async () => ({
      repository: {
        pullRequest: {
          reviewThreads: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: Array(unresolvedThreads)
              .fill(null)
              .map(() => ({ isResolved: false })),
          },
        },
      },
    }),
  } as unknown as Octokit;
}
