/**
 * octokit.mock.ts - Mock Octokit type and factory for lysbot-merge tests
 *
 * Exports MockedOctokit type and createMockOctokit factory so that test code
 * can access .mock, .mockResolvedValue, .calls etc. with proper typing.
 *
 * Uses @octokit/core, @octokit/plugin-rest-endpoint-methods, and
 * @octokit/plugin-paginate-rest directly for reliable type resolution in
 * ESLint/TypeScript, instead of re-exporting from @actions/github.
 */

import type { Octokit } from '@octokit/core';
import type { PaginateInterface } from '@octokit/plugin-paginate-rest';
import type { Api } from '@octokit/plugin-rest-endpoint-methods';
import { vi, type MockedFunction } from 'vitest';

/**
 * Full Octokit type as returned by @actions/github getOctokit().
 * Combines base Octokit with REST API and paginate plugin.
 */
type ActionsOctokit = Octokit & Api & { paginate: PaginateInterface };

/**
 * Octokit type with mocked methods typed as MockedFunction so that
 * .mock, .mockResolvedValue, .mockImplementation, .calls etc. are valid.
 * Assignable to Octokit so it can be passed to executeAction, github-api, etc.
 */
export type MockedOctokit = Omit<ActionsOctokit, 'rest' | 'paginate' | 'graphql'> & {
  rest: Omit<Api['rest'], 'reactions' | 'issues' | 'repos' | 'pulls'> & {
    reactions: {
      createForIssueComment: MockedFunction<Api['rest']['reactions']['createForIssueComment']>;
    };
    issues: Omit<Api['rest']['issues'], 'createComment' | 'listComments'> & {
      createComment: MockedFunction<Api['rest']['issues']['createComment']>;
      listComments: MockedFunction<Api['rest']['issues']['listComments']>;
    };
    repos: {
      getCollaboratorPermissionLevel: MockedFunction<Api['rest']['repos']['getCollaboratorPermissionLevel']>;
    };
    pulls: Omit<Api['rest']['pulls'], 'get' | 'listReviews' | 'listCommits' | 'dismissReview' | 'merge'> & {
      get: MockedFunction<Api['rest']['pulls']['get']>;
      listReviews: MockedFunction<Api['rest']['pulls']['listReviews']>;
      listCommits: MockedFunction<Api['rest']['pulls']['listCommits']>;
      dismissReview: MockedFunction<Api['rest']['pulls']['dismissReview']>;
      merge: MockedFunction<Api['rest']['pulls']['merge']>;
    };
  };
  paginate: MockedFunction<PaginateInterface>;
  /** Intersection preserves assignability to Octokit while allowing .mock access */
  graphql: Octokit['graphql'] & MockedFunction<Octokit['graphql']>;
};

/**
 * Creates a mock Octokit instance for tests.
 * Return type is MockedOctokit & ActionsOctokit so that .mock.calls, .mockResolvedValue
 * etc. are typed and the result is assignable to Octokit when passed to executeAction.
 */
export function createMockOctokit(): MockedOctokit & ActionsOctokit {
  return {
    rest: {
      reactions: {
        createForIssueComment: vi.fn().mockResolvedValue({}),
      },
      issues: {
        createComment: vi.fn().mockResolvedValue({}),
        listComments: vi.fn().mockResolvedValue({ data: [] }),
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
          data: {
            sha: 'merge123456789',
            merged: true,
            message: 'Pull request successfully merged',
          },
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
  } as unknown as MockedOctokit & ActionsOctokit;
}
