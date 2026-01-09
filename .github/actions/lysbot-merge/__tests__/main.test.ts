/**
 * main.test.ts - Tests for main.ts module
 *
 * Tests cover the run() function which is the Composition Root.
 * This tests DI assembly and integration.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock modules before importing
const mockCore = {
  getInput: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
  warning: vi.fn(),
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
        get: vi.fn(),
        merge: vi.fn(),
      },
      issues: {
        listComments: vi.fn(),
        createComment: vi.fn(),
      },
      reactions: {
        createForIssueComment: vi.fn(),
      },
    },
    paginate: vi.fn().mockResolvedValue([]),
    graphql: vi.fn().mockResolvedValue({}),
  }),
};

const mockExecuteMerge = vi.fn().mockResolvedValue({
  status: 'skipped',
  message: 'Not a merge command',
});

const mockReadActionInputs = vi.fn().mockReturnValue({
  releaseBranchPrefix: 'release/',
  developBranch: 'develop',
  syncBranchPrefix: 'fix/sync/',
  mergeableRetryCount: 5,
  mergeableRetryInterval: 10,
});

const mockBuildEventContext = vi.fn().mockReturnValue({
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
});

const mockWriteActionOutputs = vi.fn();
const mockWriteActionSummary = vi.fn().mockResolvedValue(undefined);

class MockGitHubAdapter {
  constructor(
    public octokit: unknown,
    public owner: string,
    public repo: string,
  ) {}
}

vi.mock('@actions/core', () => mockCore);
vi.mock('@actions/github', () => mockGithub);

vi.mock('../src/modules/lysbot-merge/index.js', () => ({
  readActionInputs: mockReadActionInputs,
  buildEventContext: mockBuildEventContext,
  writeActionOutputs: mockWriteActionOutputs,
  writeActionSummary: mockWriteActionSummary,
  executeMerge: mockExecuteMerge,
  GitHubAdapter: MockGitHubAdapter,
}));

// Import after mocks are set up
const { run } = await import('../src/main.js');

describe('main.ts - Composition Root', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Set default environment
    process.env.GITHUB_SERVER_URL = 'https://github.com';

    // Default input values
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'github-token') {
        return 'test-token';
      }
      return '';
    });

    // Reset default mock return value
    mockExecuteMerge.mockResolvedValue({
      status: 'merged',
      message: 'Pull request successfully merged',
      mergeMethod: 'squash',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('run() - DI assembly', () => {
    it('should successfully perform DI and execute merge', async () => {
      await run();

      // Verify token was read
      expect(mockCore.getInput).toHaveBeenCalledWith('github-token', { required: true });

      // Verify Octokit was created
      expect(mockGithub.getOctokit).toHaveBeenCalledWith('test-token');

      // Verify ACTION layer functions were called
      expect(mockReadActionInputs).toHaveBeenCalled();
      expect(mockBuildEventContext).toHaveBeenCalled();

      // Verify APP layer function was called
      expect(mockExecuteMerge).toHaveBeenCalled();

      // Verify ACTION layer output functions were called
      expect(mockWriteActionOutputs).toHaveBeenCalled();
      expect(mockWriteActionSummary).toHaveBeenCalled();

      // Verify info was logged
      expect(mockCore.info).toHaveBeenCalledWith('lysbot-merge result: merged - Pull request successfully merged');

      // Verify no failure
      expect(mockCore.setFailed).not.toHaveBeenCalled();
    });

    it('should handle failed merge result', async () => {
      mockExecuteMerge.mockResolvedValue({
        status: 'failed',
        message: 'Merge checks failed',
      });

      await run();

      expect(mockWriteActionOutputs).toHaveBeenCalled();
      expect(mockCore.info).toHaveBeenCalledWith('lysbot-merge result: failed - Merge checks failed');
      expect(mockCore.info).toHaveBeenCalledWith('Merge checks or operation failed. See PR comments for details.');
      expect(mockCore.setFailed).not.toHaveBeenCalled();
    });

    it('should handle errors from executeMerge', async () => {
      mockExecuteMerge.mockRejectedValue(new Error('API error'));

      await run();

      expect(mockCore.setFailed).toHaveBeenCalledWith('lysbot-merge action failed: API error');
      expect(mockWriteActionOutputs).not.toHaveBeenCalled();
      expect(mockWriteActionSummary).not.toHaveBeenCalled();
    });

    it('should handle non-Error exceptions', async () => {
      mockExecuteMerge.mockRejectedValue('string error');

      await run();

      expect(mockCore.setFailed).toHaveBeenCalledWith('lysbot-merge action failed: Unknown error');
    });
  });
});
