/**
 * main.test.ts - Tests for main.ts module
 *
 * Tests cover the run() function which is the main entry point for the GitHub Action.
 * This tests the GitHub Actions runtime integration code using vitest mocks.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock @actions/core
vi.mock('@actions/core', () => ({
  getInput: vi.fn(),
  setOutput: vi.fn(),
  setFailed: vi.fn(),
  info: vi.fn(),
  summary: {
    addRaw: vi.fn().mockReturnThis(),
    write: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock @actions/github
vi.mock('@actions/github', () => ({
  getOctokit: vi.fn(),
  context: {
    repo: {
      owner: 'test-owner',
      repo: 'test-repo',
    },
    payload: {
      issue: {
        number: 123,
        pull_request: {},
      },
      comment: {
        id: 456,
        body: '/lysbot merge',
        user: {
          type: 'User',
        },
        author_association: 'MEMBER',
      },
    },
    actor: 'test-actor',
    runId: 789,
    eventName: 'issue_comment',
  },
}));

// Mock the executeAction function
vi.mock('../src/action.js', () => ({
  executeAction: vi.fn(),
  buildSummaryMarkdown: vi.fn(),
}));

// Import the module under test after mocks are set up
import { run } from '../src/main.js';
import * as core from '@actions/core';
import * as github from '@actions/github';
import * as action from '../src/action.js';

// Helper function to safely set mock context payload
function setMockContextPayload(payload: Record<string, unknown>): void {
  const ctx = github.context as { payload: unknown };
  ctx.payload = payload;
}

describe('main.ts', () => {
  let mockGetInput: ReturnType<typeof vi.fn>;
  let mockSetOutput: ReturnType<typeof vi.fn>;
  let mockSetFailed: ReturnType<typeof vi.fn>;
  let mockInfo: ReturnType<typeof vi.fn>;
  let mockSummary: typeof core.summary;
  let mockGetOctokit: ReturnType<typeof vi.fn>;
  let mockContext: typeof github.context;
  let mockExecuteAction: ReturnType<typeof vi.fn>;
  let mockBuildSummaryMarkdown: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Get references to the mocked functions
    mockGetInput = vi.mocked(core.getInput);
    mockSetOutput = vi.mocked(core.setOutput);
    mockSetFailed = vi.mocked(core.setFailed);
    mockInfo = vi.mocked(core.info);
    mockSummary = core.summary;
    mockGetOctokit = vi.mocked(github.getOctokit);
    mockContext = github.context;
    mockExecuteAction = vi.mocked(action.executeAction);
    mockBuildSummaryMarkdown = vi.mocked(action.buildSummaryMarkdown);

    // Reset all mocks before each test
    vi.clearAllMocks();

    // Re-initialize summary methods with proper typing
    const summaryWithMocks = mockSummary as unknown as {
      addRaw: ReturnType<typeof vi.fn>;
      write: ReturnType<typeof vi.fn>;
    };
    summaryWithMocks.addRaw = vi.fn().mockReturnValue(mockSummary);
    summaryWithMocks.write = vi.fn().mockResolvedValue(undefined);

    // Set default mock implementations
    mockGetInput.mockImplementation((name: string) => {
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

    // Mock Octokit with minimal required structure
    const mockOctokitInstance = {
      rest: {},
      paginate: vi.fn(),
      graphql: vi.fn(),
    };
    mockGetOctokit.mockReturnValue(mockOctokitInstance as never);

    mockExecuteAction.mockResolvedValue({
      status: 'merged',
      message: 'Pull request successfully merged',
      mergeMethod: 'squash',
    });

    mockBuildSummaryMarkdown.mockReturnValue('# Test Summary');

    // Reset context to default using helper
    setMockContextPayload({
      issue: {
        number: 123,
        pull_request: {},
      },
      comment: {
        id: 456,
        body: '/lysbot merge',
        user: {
          type: 'User',
        },
        author_association: 'MEMBER',
      },
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('run()', () => {
    it('should successfully execute with default configuration', async () => {
      await run();

      // Verify inputs were read
      expect(mockGetInput).toHaveBeenCalledWith('github-token', { required: true });

      // Verify octokit was created
      expect(mockGetOctokit).toHaveBeenCalledWith('test-token');

      // Verify executeAction was called
      expect(mockExecuteAction).toHaveBeenCalled();

      // Verify outputs were set
      expect(mockSetOutput).toHaveBeenCalledWith('result', 'merged');
      expect(mockSetOutput).toHaveBeenCalledWith('merge_method', 'squash');

      // Verify summary was written
      expect(mockBuildSummaryMarkdown).toHaveBeenCalled();
      expect(mockSummary.addRaw).toHaveBeenCalledWith('# Test Summary');
      expect(mockSummary.write).toHaveBeenCalled();

      // Verify info was logged
      expect(mockInfo).toHaveBeenCalledWith('lysbot-merge result: merged - Pull request successfully merged');

      // Verify no failure
      expect(mockSetFailed).not.toHaveBeenCalled();
    });

    it('should handle custom configuration inputs', async () => {
      mockGetInput.mockImplementation((name: string) => {
        const customConfig: Record<string, string> = {
          'github-token': 'custom-token',
          release_branch_prefix: 'rel/',
          develop_branch: 'main',
          sync_branch_prefix: 'sync/',
          mergeable_retry_count: '3',
          mergeable_retry_interval: '5',
        };
        return customConfig[name] || '';
      });

      await run();

      // Verify executeAction was called with custom config
      const executeActionCall = mockExecuteAction.mock.calls[0];
      const config = executeActionCall[2];

      expect(config).toEqual({
        releaseBranchPrefix: 'rel/',
        developBranch: 'main',
        syncBranchPrefix: 'sync/',
        mergeableRetryCount: 3,
        mergeableRetryInterval: 5,
      });
    });

    it('should use default values when optional inputs are empty', async () => {
      mockGetInput.mockImplementation((name: string) => {
        if (name === 'github-token') return 'test-token';
        return '';
      });

      await run();

      const executeActionCall = mockExecuteAction.mock.calls[0];
      const config = executeActionCall[2];

      expect(config).toEqual({
        releaseBranchPrefix: 'release/',
        developBranch: 'develop',
        syncBranchPrefix: 'fix/sync/',
        mergeableRetryCount: 5,
        mergeableRetryInterval: 10,
      });
    });

    it('should handle skipped merge result', async () => {
      mockExecuteAction.mockResolvedValue({
        status: 'skipped',
        message: 'Merge was skipped',
        mergeMethod: undefined,
      });

      await run();

      expect(mockSetOutput).toHaveBeenCalledWith('result', 'skipped');
      expect(mockSetOutput).not.toHaveBeenCalledWith('merge_method', expect.anything());
      expect(mockInfo).toHaveBeenCalledWith('lysbot-merge result: skipped - Merge was skipped');
      expect(mockSetFailed).not.toHaveBeenCalled();
    });

    it('should handle failed merge result', async () => {
      mockExecuteAction.mockResolvedValue({
        status: 'failed',
        message: 'Merge checks failed',
        mergeMethod: undefined,
      });

      await run();

      expect(mockSetOutput).toHaveBeenCalledWith('result', 'failed');
      expect(mockInfo).toHaveBeenCalledWith('lysbot-merge result: failed - Merge checks failed');
      expect(mockInfo).toHaveBeenCalledWith('Merge checks or operation failed. See PR comments for details.');
      expect(mockSetFailed).not.toHaveBeenCalled();
    });

    it('should handle already_merged result', async () => {
      mockExecuteAction.mockResolvedValue({
        status: 'already_merged',
        message: 'Pull request is already merged',
        mergeMethod: undefined,
      });

      await run();

      expect(mockSetOutput).toHaveBeenCalledWith('result', 'already_merged');
      expect(mockSetFailed).not.toHaveBeenCalled();
    });

    it('should build correct event context from GitHub context', async () => {
      await run();

      const executeActionCall = mockExecuteAction.mock.calls[0];
      const context = executeActionCall[1];

      expect(context).toEqual({
        owner: 'test-owner',
        repo: 'test-repo',
        prNumber: 123,
        commentId: 456,
        commentBody: '/lysbot merge',
        actor: 'test-actor',
        userType: 'User',
        authorAssociation: 'MEMBER',
        serverUrl: 'https://github.com',
        runId: 789,
        eventName: 'issue_comment',
        isPullRequest: true,
      });
    });

    it('should handle missing pull_request in payload', async () => {
      setMockContextPayload({
        issue: {
          number: 123,
        },
        comment: {
          id: 456,
          body: '/lysbot merge',
          user: {
            type: 'User',
          },
          author_association: 'MEMBER',
        },
      });

      await run();

      const executeActionCall = mockExecuteAction.mock.calls[0];
      const context = executeActionCall[1];

      expect(context.isPullRequest).toBe(false);
    });

    it('should handle missing comment in payload', async () => {
      setMockContextPayload({
        issue: {
          number: 123,
          pull_request: {},
        },
      });

      await run();

      const executeActionCall = mockExecuteAction.mock.calls[0];
      const context = executeActionCall[1];

      expect(context.commentId).toBe(0);
      expect(context.commentBody).toBe('');
      expect(context.userType).toBe('User');
      expect(context.authorAssociation).toBe('NONE');
    });

    it('should use GITHUB_SERVER_URL from environment if available', async () => {
      const originalEnv = process.env.GITHUB_SERVER_URL;
      process.env.GITHUB_SERVER_URL = 'https://github.enterprise.com';

      await run();

      const executeActionCall = mockExecuteAction.mock.calls[0];
      const context = executeActionCall[1];

      expect(context.serverUrl).toBe('https://github.enterprise.com');

      // Restore original environment
      if (originalEnv === undefined) {
        delete process.env.GITHUB_SERVER_URL;
      } else {
        process.env.GITHUB_SERVER_URL = originalEnv;
      }
    });

    it('should handle errors from executeAction', async () => {
      mockExecuteAction.mockRejectedValue(new Error('API error'));

      await run();

      expect(mockSetFailed).toHaveBeenCalledWith('lysbot-merge action failed: API error');
      expect(mockSetOutput).not.toHaveBeenCalled();
      expect(mockSummary.write).not.toHaveBeenCalled();
    });

    it('should handle non-Error exceptions', async () => {
      mockExecuteAction.mockRejectedValue('string error');

      await run();

      expect(mockSetFailed).toHaveBeenCalledWith('lysbot-merge action failed: Unknown error');
    });

    it('should build correct summary markdown', async () => {
      await run();

      expect(mockBuildSummaryMarkdown).toHaveBeenCalledWith('✅ Merged successfully', 123, 'test-actor', 'squash');
    });

    it('should handle different merge methods in summary', async () => {
      mockExecuteAction.mockResolvedValue({
        status: 'merged',
        message: 'Pull request successfully merged',
        mergeMethod: 'merge',
      });

      await run();

      expect(mockBuildSummaryMarkdown).toHaveBeenCalledWith('✅ Merged successfully', 123, 'test-actor', 'merge');
    });

    it('should parse integer inputs correctly', async () => {
      mockGetInput.mockImplementation((name: string) => {
        const config: Record<string, string> = {
          'github-token': 'test-token',
          mergeable_retry_count: '10',
          mergeable_retry_interval: '20',
        };
        return config[name] || '';
      });

      await run();

      const executeActionCall = mockExecuteAction.mock.calls[0];
      const config = executeActionCall[2];

      expect(config.mergeableRetryCount).toBe(10);
      expect(config.mergeableRetryInterval).toBe(20);
    });

    it('should handle invalid integer inputs gracefully', async () => {
      mockGetInput.mockImplementation((name: string) => {
        const config: Record<string, string> = {
          'github-token': 'test-token',
          mergeable_retry_count: 'not-a-number',
          mergeable_retry_interval: 'also-not-a-number',
        };
        return config[name] || '';
      });

      await run();

      const executeActionCall = mockExecuteAction.mock.calls[0];
      const config = executeActionCall[2];

      // parseInt returns NaN for invalid numbers
      expect(Number.isNaN(config.mergeableRetryCount)).toBe(true);
      expect(Number.isNaN(config.mergeableRetryInterval)).toBe(true);
    });
  });
});
