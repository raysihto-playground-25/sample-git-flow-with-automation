/**
 * Test fixtures and helper functions for creating test data
 */

import type { ActionConfig, EventContext, Octokit, PullRequestData } from '../../src/modules/merge/internal/types.js';

export function createMockConfig(overrides: Partial<ActionConfig> = {}): ActionConfig {
  return {
    releaseBranchPrefix: 'release/',
    developBranch: 'develop',
    syncBranchPrefix: 'fix/sync/',
    mergeableRetryCount: 5,
    mergeableRetryInterval: 10,
    ...overrides,
  };
}

export function createMockEventContext(overrides: Partial<EventContext> = {}): EventContext {
  return {
    owner: 'test-owner',
    repo: 'test-repo',
    prNumber: 123,
    commentId: 999,
    commentBody: '/lysbot merge',
    actor: 'test-actor',
    userType: 'User',
    authorAssociation: 'MEMBER',
    serverUrl: 'https://github.com',
    runId: 12345,
    eventName: 'issue_comment',
    isPullRequest: true,
    ...overrides,
  };
}

export function createMockPullRequestData(overrides: Partial<PullRequestData> = {}): PullRequestData {
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

export function createMockOctokit(): Octokit {
  return {
    rest: {
      reactions: {
        createForIssueComment: async () => ({}),
      },
      issues: {
        createComment: async () => ({}),
      },
      repos: {
        getCollaboratorPermissionLevel: async () => ({
          data: { permission: 'write' },
        }),
      },
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
        listReviews: async () => ({ data: [] }),
        listCommits: async () => ({ data: [] }),
        dismissReview: async () => ({}),
        merge: async () => ({
          data: { sha: 'merge123456789', merged: true, message: 'Pull request successfully merged' },
        }),
      },
    },
    paginate: async () => [],
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
}
