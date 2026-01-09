/**
 * main.test.ts - Tests for main.ts composition root
 *
 * Tests cover the run() function which acts as the composition root for dependency injection.
 * This tests the GitHub Actions runtime integration using vitest mocks.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock modules before importing
const mockCore = {
  getInput: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
  info: vi.fn(),
  summary: {
    addRaw: vi.fn().mockReturnThis(),
    write: vi.fn().mockResolvedValue(undefined),
  },
};

const mockGithub = {
  context: {
    repo: { owner: 'test-owner', repo: 'test-repo' },
    actor: 'test-actor',
    runId: 12345,
    eventName: 'issue_comment',
    payload: {
      issue: {
        number: 123,
        pull_request: {},
      },
      comment: {
        id: 999,
        body: '/lysbot merge',
        user: { type: 'User' },
        author_association: 'MEMBER',
      },
    },
  },
  getOctokit: vi.fn().mockReturnValue({
    rest: {
      pulls: {
        get: vi.fn().mockResolvedValue({
          data: {
            state: 'open',
            locked: false,
            draft: false,
            merged: false,
            mergeable: true,
            mergeable_state: 'clean',
            head: { sha: 'abc', ref: 'feature', repo: { fork: false, owner: { id: 1 } } },
            base: { ref: 'main', repo: { owner: { id: 1 } } },
            user: { login: 'author' },
            title: 'Test PR',
          },
        }),
        listCommits: vi.fn().mockResolvedValue({ data: [] }),
        listReviews: vi.fn().mockResolvedValue({ data: [] }),
        merge: vi.fn().mockResolvedValue({ data: { sha: 'merge-sha' } }),
        dismissReview: vi.fn().mockResolvedValue({}),
      },
      issues: {
        createComment: vi.fn().mockResolvedValue({}),
      },
      reactions: {
        createForIssueComment: vi.fn().mockResolvedValue({}),
      },
      repos: {
        getCollaboratorPermissionLevel: vi.fn().mockResolvedValue({
          data: { permission: 'write' },
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
  }),
};

vi.mock('@actions/core', () => mockCore);
vi.mock('@actions/github', () => mockGithub);

// Import after mocks are set up
const { run } = await import('../src/main.js');

// Helper function to safely set mock context payload
function setMockContextPayload(payload: Record<string, unknown>): void {
  const ctx = mockGithub.context as { payload: unknown };
  ctx.payload = payload;
}

describe('main.ts - Composition Root', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Default input values
    mockCore.getInput.mockImplementation((name: string) => {
      const defaults: Record<string, string> = {
        'github-token': 'test-token',
        release_branch_prefix: 'release/',
        develop_branch: 'develop',
        sync_branch_prefix: 'fix/sync/',
        mergeable_retry_count: '5',
        mergeable_retry_interval: '10',
      };
      return defaults[name] || '';
    });

    // Reset default context
    setMockContextPayload({
      issue: {
        number: 123,
        pull_request: {},
      },
      comment: {
        id: 999,
        body: '/lysbot merge',
        user: { type: 'User' },
        author_association: 'MEMBER',
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Input handling', () => {
    it('should read github-token input', async () => {
      await run();

      expect(mockCore.getInput).toHaveBeenCalledWith('github-token', { required: true });
    });

    it('should read configuration inputs', async () => {
      await run();

      expect(mockCore.getInput).toHaveBeenCalledWith('release_branch_prefix');
      expect(mockCore.getInput).toHaveBeenCalledWith('develop_branch');
      expect(mockCore.getInput).toHaveBeenCalledWith('sync_branch_prefix');
      expect(mockCore.getInput).toHaveBeenCalledWith('mergeable_retry_count');
      expect(mockCore.getInput).toHaveBeenCalledWith('mergeable_retry_interval');
    });

    it('should use default values when inputs are not provided', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'github-token') {
          return 'test-token';
        }
        return '';
      });

      await run();

      // Should not throw - default values are applied in the code
      expect(mockCore.setFailed).not.toHaveBeenCalled();
    });
  });

  describe('Output handling', () => {
    it('should set result output', async () => {
      await run();

      expect(mockCore.setOutput).toHaveBeenCalledWith('result', expect.any(String));
    });

    it('should write summary', async () => {
      await run();

      expect(mockCore.summary.addRaw).toHaveBeenCalled();
      expect(mockCore.summary.write).toHaveBeenCalled();
    });

    it('should log result', async () => {
      await run();

      expect(mockCore.info).toHaveBeenCalledWith(expect.stringContaining('lysbot-merge result'));
    });
  });

  describe('Error handling', () => {
    it('should handle errors and call setFailed', async () => {
      mockCore.getInput.mockImplementation(() => {
        throw new Error('Input error');
      });

      await run();

      expect(mockCore.setFailed).toHaveBeenCalledWith(expect.stringContaining('Input error'));
    });

    it('should handle non-Error exceptions', async () => {
      mockCore.getInput.mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'String error';
      });

      await run();

      expect(mockCore.setFailed).toHaveBeenCalledWith(expect.stringContaining('Unknown error'));
    });
  });

  describe('Context parsing', () => {
    it('should extract PR number from issue.number', async () => {
      setMockContextPayload({
        issue: { number: 456, pull_request: {} },
        comment: { id: 999, body: '/lysbot merge', user: { type: 'User' }, author_association: 'MEMBER' },
      });

      await run();

      // The use case should have been called with PR number 456
      expect(mockCore.summary.addRaw).toHaveBeenCalledWith(expect.stringContaining('#456'));
    });

    it('should handle missing comment gracefully', async () => {
      setMockContextPayload({
        issue: { number: 123, pull_request: {} },
      });

      await run();

      // Should not crash
      expect(mockCore.setFailed).not.toHaveBeenCalled();
    });
  });

  describe('Dependency injection', () => {
    it('should create Octokit with provided token', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'github-token') {
          return 'custom-token';
        }
        return '';
      });

      await run();

      expect(mockGithub.getOctokit).toHaveBeenCalledWith('custom-token');
    });

    it('should wire up all dependencies correctly', async () => {
      await run();

      // If execution completes without error, dependencies were wired correctly
      expect(mockCore.setFailed).not.toHaveBeenCalled();
    });
  });
});
