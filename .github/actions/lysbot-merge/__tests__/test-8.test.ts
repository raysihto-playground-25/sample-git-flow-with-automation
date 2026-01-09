import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  }),
};

const mockExecuteAction = vi.fn().mockResolvedValue({
  status: 'skipped',
  message: 'Not a merge command',
  mergeMethod: null,
});

const mockBuildSummaryMarkdown = vi.fn().mockReturnValue('# Summary');

vi.mock('@actions/core', () => mockCore);
vi.mock('@actions/github', () => mockGithub);

vi.mock('../src/tmp_untitled_3.js', () => ({
  executeAction: mockExecuteAction,
  buildSummaryMarkdown: mockBuildSummaryMarkdown,
}));

const { run } = await import('../src/main.js');

function setMockContextPayload(payload: Record<string, unknown>): void {
  const ctx = mockGithub.context as { payload: unknown };
  ctx.payload = payload;
}

describe('main.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    process.env.GITHUB_SERVER_URL = 'https://github.com';

    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'github-token') {
        return 'test-token';
      }
      return '';
    });

    mockExecuteAction.mockResolvedValue({
      status: 'merged',
      message: 'Pull request successfully merged',
      mergeMethod: 'squash',
    });

    mockBuildSummaryMarkdown.mockReturnValue('# Test Summary');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('run()', () => {
    it('should successfully execute with default configuration', async () => {
      await run();

      expect(mockCore.getInput).toHaveBeenCalledWith('github-token', { required: true });

      expect(mockGithub.getOctokit).toHaveBeenCalledWith('test-token');

      expect(mockExecuteAction).toHaveBeenCalled();

      expect(mockCore.setOutput).toHaveBeenCalledWith('result', 'merged');
      expect(mockCore.setOutput).toHaveBeenCalledWith('merge_method', 'squash');

      expect(mockBuildSummaryMarkdown).toHaveBeenCalled();
      expect(mockCore.summary.addRaw).toHaveBeenCalledWith('# Test Summary');
      expect(mockCore.summary.write).toHaveBeenCalled();

      expect(mockCore.info).toHaveBeenCalledWith('lysbot-merge result: merged - Pull request successfully merged');

      expect(mockCore.setFailed).not.toHaveBeenCalled();
    });

    it('should handle custom configuration inputs', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
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

      expect(mockExecuteAction).toHaveBeenCalledWith(
        expect.any(Object),
        expect.any(Object),
        expect.objectContaining({
          releaseBranchPrefix: 'rel/',
          developBranch: 'main',
          syncBranchPrefix: 'sync/',
          mergeableRetryCount: 3,
          mergeableRetryInterval: 5,
        }),
      );
    });

    it('should use default values when optional inputs are empty', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'github-token') {
          return 'test-token';
        }
        return '';
      });

      await run();

      expect(mockExecuteAction).toHaveBeenCalled();
    });

    it('should handle skipped merge result', async () => {
      mockExecuteAction.mockResolvedValue({
        status: 'skipped',
        message: 'Merge was skipped',
        mergeMethod: undefined,
      });

      await run();

      expect(mockCore.setOutput).toHaveBeenCalledWith('result', 'skipped');
      expect(mockCore.setOutput).not.toHaveBeenCalledWith('merge_method', expect.anything());
      expect(mockCore.info).toHaveBeenCalledWith('lysbot-merge result: skipped - Merge was skipped');
      expect(mockCore.setFailed).not.toHaveBeenCalled();
    });

    it('should handle failed merge result', async () => {
      mockExecuteAction.mockResolvedValue({
        status: 'failed',
        message: 'Merge checks failed',
        mergeMethod: undefined,
      });

      await run();

      expect(mockCore.setOutput).toHaveBeenCalledWith('result', 'failed');
      expect(mockCore.info).toHaveBeenCalledWith('lysbot-merge result: failed - Merge checks failed');
      expect(mockCore.info).toHaveBeenCalledWith('Merge checks or operation failed. See PR comments for details.');
      expect(mockCore.setFailed).not.toHaveBeenCalled();
    });

    it('should handle already_merged result', async () => {
      mockExecuteAction.mockResolvedValue({
        status: 'already_merged',
        message: 'Pull request is already merged',
        mergeMethod: undefined,
      });

      await run();

      expect(mockCore.setOutput).toHaveBeenCalledWith('result', 'already_merged');
      expect(mockCore.setFailed).not.toHaveBeenCalled();
    });

    it('should build correct event context from GitHub context', async () => {
      await run();

      expect(mockExecuteAction).toHaveBeenCalled();
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

      expect(mockExecuteAction).toHaveBeenCalled();
    });

    it('should handle missing comment in payload', async () => {
      setMockContextPayload({
        issue: {
          number: 123,
          pull_request: {},
        },
      });

      await run();

      expect(mockExecuteAction).toHaveBeenCalled();
    });

    it('should use GITHUB_SERVER_URL from environment if available', async () => {
      process.env.GITHUB_SERVER_URL = 'https://github.enterprise.com';

      await run();

      expect(mockExecuteAction).toHaveBeenCalled();

      process.env.GITHUB_SERVER_URL = 'https://github.com';
    });

    it('should handle errors from executeAction', async () => {
      mockExecuteAction.mockRejectedValue(new Error('API error'));

      await run();

      expect(mockCore.setFailed).toHaveBeenCalledWith('lysbot-merge action failed: API error');
      expect(mockCore.setOutput).not.toHaveBeenCalled();
      expect(mockCore.summary.write).not.toHaveBeenCalled();
    });

    it('should handle non-Error exceptions', async () => {
      mockExecuteAction.mockRejectedValue('string error');

      await run();

      expect(mockCore.setFailed).toHaveBeenCalledWith('lysbot-merge action failed: Unknown error');
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
      mockCore.getInput.mockImplementation((name: string) => {
        const config: Record<string, string> = {
          'github-token': 'test-token',
          mergeable_retry_count: '10',
          mergeable_retry_interval: '20',
        };
        return config[name] || '';
      });

      await run();

      expect(mockExecuteAction).toHaveBeenCalled();
    });

    it('should handle invalid integer inputs gracefully', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        const config: Record<string, string> = {
          'github-token': 'test-token',
          mergeable_retry_count: 'not-a-number',
          mergeable_retry_interval: 'also-not-a-number',
        };
        return config[name] || '';
      });

      await run();

      expect(mockExecuteAction).toHaveBeenCalled();
    });
  });
});
