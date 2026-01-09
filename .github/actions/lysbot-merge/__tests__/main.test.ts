/**
 * __tests__/main.test.ts
 *
 * Tests for the composition root (main.ts) - verifies input reading and DI setup.
 */

/* eslint-disable @typescript-eslint/unbound-method */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@actions/core');
vi.mock('@actions/github');

// Import after mocks
import { run } from '../src/main.js';

describe('main.ts composition root', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'github-token': 'test-token',
        release_branch_prefix: 'release/',
        develop_branch: 'develop',
        sync_branch_prefix: 'fix/sync/',
        mergeable_retry_count: '5',
        mergeable_retry_interval: '10',
      };
      return inputs[name] || '';
    });

    const mockContext = {
      repo: { owner: 'test-owner', repo: 'test-repo' },
      actor: 'testuser',
      runId: 123,
      eventName: 'issue_comment',
      payload: {
        issue: {
          number: 456,
          pull_request: {},
        },
        comment: {
          id: 789,
          body: '/lysbot merge',
          user: { type: 'User' },
          author_association: 'OWNER',
        },
      },
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment
    vi.mocked(github).context = mockContext as any;

    const mockOctokit = {
      rest: {
        reactions: { createForIssueComment: vi.fn() },
        issues: { createComment: vi.fn() },
        repos: { getCollaboratorPermissionLevel: vi.fn().mockResolvedValue({ data: { permission: 'write' } }) },
        pulls: {
          get: vi.fn().mockResolvedValue({
            data: {
              state: 'open',
              locked: false,
              draft: false,
              merged: true,
              mergeable: true,
              mergeable_state: 'clean',
              head: { sha: 'abc123', ref: 'feature/test', repo: { fork: false, owner: { id: 1 } } },
              base: { ref: 'main', repo: { owner: { id: 1 } } },
              user: { login: 'user' },
              title: 'Test PR',
            },
          }),
          listReviews: vi.fn(),
          listCommits: vi.fn(),
          merge: vi.fn(),
          dismissReview: vi.fn(),
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
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument
    vi.mocked(github.getOctokit).mockReturnValue(mockOctokit as any);

    const mockSummary = {
      addRaw: vi.fn().mockReturnThis(),
      write: vi.fn().mockResolvedValue(undefined),
    };
    Object.defineProperty(core, 'summary', {
      value: mockSummary,
      writable: true,
    });

    process.env.GITHUB_SERVER_URL = 'https://github.com';
  });

  afterEach(() => {
    delete process.env.GITHUB_SERVER_URL;
  });

  it('should read inputs and run successfully for already merged PR', async () => {
    await run();

    expect(core.getInput).toHaveBeenCalledWith('github-token', { required: true });

    expect(core.setOutput).toHaveBeenCalledWith('result', 'already_merged');
    expect(core.summary.addRaw).toHaveBeenCalled();
    expect(core.summary.write).toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    vi.mocked(core.getInput).mockImplementation(() => {
      throw new Error('Test error');
    });

    await run();

    expect(core.setFailed).toHaveBeenCalledWith(expect.stringContaining('Test error'));
  });

  it('should parse integer inputs correctly', async () => {
    vi.mocked(core.getInput).mockImplementation((name: string) => {
      if (name === 'mergeable_retry_count') {
        return '10';
      }
      if (name === 'mergeable_retry_interval') {
        return '20';
      }
      if (name === 'github-token') {
        return 'test-token';
      }
      return '';
    });

    await run();

    // Should not throw error for integer parsing

    expect(core.setFailed).not.toHaveBeenCalled();
  });
});
