/**
 * main.test.ts - Integration tests for main.ts (composition root)
 *
 * Tests verify that main.ts correctly assembles dependencies and calls the action.
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
    rest: {},
    graphql: vi.fn(),
    paginate: vi.fn(),
  }),
};

vi.mock('@actions/core', () => ({
  default: mockCore,
  ...mockCore,
}));

vi.mock('@actions/github', () => ({
  default: mockGithub,
  ...mockGithub,
}));

// Mock the action module to avoid running the full action
const mockRunMergeAction = vi.fn().mockResolvedValue({
  status: 'skipped',
  message: 'Test skipped',
});

const mockBuildSummaryMarkdown = vi.fn().mockReturnValue('# Summary');

vi.mock('../src/modules/merge/index.js', async () => {
  const actual = await vi.importActual('../src/modules/merge/index.js');
  return {
    ...actual,
    runMergeAction: mockRunMergeAction,
    buildSummaryMarkdown: mockBuildSummaryMarkdown,
  };
});

// Import after mocks are set up
const { run } = await import('../src/main.js');

describe('main.ts (Composition Root)', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Set default environment
    process.env.GITHUB_SERVER_URL = 'https://github.com';

    // Default input values
    mockCore.getInput.mockImplementation((name: string, options?: { required?: boolean }) => {
      if (name === 'github-token') {
        return 'test-token';
      }
      if (options?.required) {
        throw new Error(`Input required and not supplied: ${name}`);
      }
      return '';
    });
  });

  afterEach(() => {
    delete process.env.GITHUB_SERVER_URL;
  });

  describe('run()', () => {
    it('should successfully assemble dependencies and run the action', async () => {
      mockRunMergeAction.mockResolvedValueOnce({
        status: 'merged',
        message: 'PR merged successfully',
        mergeMethod: 'squash',
      });

      await run();

      // Verify the action was called
      expect(mockRunMergeAction).toHaveBeenCalledTimes(1);

      // Verify outputs were set
      expect(mockCore.setOutput).toHaveBeenCalledWith('result', 'merged');
      expect(mockCore.setOutput).toHaveBeenCalledWith('merge_method', 'squash');

      // Verify summary was written
      expect(mockBuildSummaryMarkdown).toHaveBeenCalled();
      expect(mockCore.summary.addRaw).toHaveBeenCalled();
      expect(mockCore.summary.write).toHaveBeenCalled();
    });

    it('should handle skipped result', async () => {
      mockRunMergeAction.mockResolvedValueOnce({
        status: 'skipped',
        message: 'Not a merge command',
      });

      await run();

      expect(mockCore.setOutput).toHaveBeenCalledWith('result', 'skipped');
      expect(mockCore.setOutput).not.toHaveBeenCalledWith('merge_method', expect.anything());
    });

    it('should handle failed result', async () => {
      mockRunMergeAction.mockResolvedValueOnce({
        status: 'failed',
        message: 'Merge checks failed',
      });

      await run();

      expect(mockCore.setOutput).toHaveBeenCalledWith('result', 'failed');
      expect(mockCore.info).toHaveBeenCalledWith('Merge checks or operation failed. See PR comments for details.');
      expect(mockCore.setFailed).not.toHaveBeenCalled();
    });

    it('should handle errors from action execution', async () => {
      mockRunMergeAction.mockRejectedValueOnce(new Error('Action execution error'));

      await run();

      expect(mockCore.setFailed).toHaveBeenCalledWith('lysbot-merge action failed: Action execution error');
    });

    it('should handle non-Error exceptions', async () => {
      mockRunMergeAction.mockRejectedValueOnce('String error');

      await run();

      expect(mockCore.setFailed).toHaveBeenCalledWith('lysbot-merge action failed: Unknown error');
    });

    it('should use GITHUB_SERVER_URL from environment', async () => {
      process.env.GITHUB_SERVER_URL = 'https://github.enterprise.com';

      await run();

      // Verify the context passed to action includes the correct server URL
      const callArgs = mockRunMergeAction.mock.calls[0];
      expect(callArgs).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(callArgs![1].serverUrl).toBe('https://github.enterprise.com');
    });
  });
});
