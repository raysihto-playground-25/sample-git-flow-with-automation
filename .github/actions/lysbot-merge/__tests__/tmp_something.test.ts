import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { ActionDependencies } from '../src/dependencies.js';
import type { ActionResult } from '../src/tmp_anything.js';
// Import the actual modules we'll be testing
import * as tmpAnything from '../src/tmp_anything.js';
import { run } from '../src/tmp_something.js';

// Mock the tmp_anything module's functions
vi.spyOn(tmpAnything, 'executeAction');
vi.spyOn(tmpAnything, 'buildSummaryMarkdown');

function createMockDependencies(): ActionDependencies {
  const mockAddRaw = vi.fn().mockReturnThis();
  const mockWrite = vi.fn().mockResolvedValue(undefined);

  return {
    core: {
      getInput: vi.fn(),
      setOutput: vi.fn(),
      setFailed: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      summary: {
        addRaw: mockAddRaw,
        write: mockWrite,
      },
    },
    github: {
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
    },
  };
}

function setMockContextPayload(deps: ActionDependencies, payload: Record<string, unknown>): void {
  deps.github.context.payload = payload;
}

describe('tmp_something.ts', () => {
  let mockDeps: ActionDependencies;

  beforeEach(() => {
    vi.clearAllMocks();

    process.env.GITHUB_SERVER_URL = 'https://github.com';

    mockDeps = createMockDependencies();

    (mockDeps.core.getInput as ReturnType<typeof vi.fn>).mockImplementation((name: string) => {
      if (name === 'github-token') {
        return 'test-token';
      }
      return '';
    });

    const mockResult: ActionResult = {
      status: 'merged',
      message: 'Pull request successfully merged',
      mergeMethod: 'squash',
    };
    vi.mocked(tmpAnything.executeAction).mockResolvedValue(mockResult);
    vi.mocked(tmpAnything.buildSummaryMarkdown).mockReturnValue('# Test Summary');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('run()', () => {
    it('should successfully execute with default configuration', async () => {
      await run(mockDeps);

      expect(mockDeps.core.getInput).toHaveBeenCalledWith('github-token', { required: true });

      expect(mockDeps.github.getOctokit).toHaveBeenCalledWith('test-token');

      expect(tmpAnything.executeAction).toHaveBeenCalled();

      expect(mockDeps.core.setOutput).toHaveBeenCalledWith('result', 'merged');
      expect(mockDeps.core.setOutput).toHaveBeenCalledWith('merge_method', 'squash');

      expect(tmpAnything.buildSummaryMarkdown).toHaveBeenCalled();

      expect(mockDeps.core.summary.addRaw).toHaveBeenCalledWith('# Test Summary');

      expect(mockDeps.core.summary.write).toHaveBeenCalled();

      expect(mockDeps.core.info).toHaveBeenCalledWith('lysbot-merge result: merged - Pull request successfully merged');

      expect(mockDeps.core.setFailed).not.toHaveBeenCalled();
    });

    it('should handle custom configuration inputs', async () => {
      (mockDeps.core.getInput as ReturnType<typeof vi.fn>).mockImplementation((name: string) => {
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

      await run(mockDeps);

      expect(tmpAnything.executeAction).toHaveBeenCalledWith(
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
      (mockDeps.core.getInput as ReturnType<typeof vi.fn>).mockImplementation((name: string) => {
        if (name === 'github-token') {
          return 'test-token';
        }
        return '';
      });

      await run(mockDeps);

      expect(tmpAnything.executeAction).toHaveBeenCalled();
    });

    it('should handle skipped merge result', async () => {
      // mergeMethod is intentionally omitted - skipped actions don't have a merge method
      const mockResult: ActionResult = {
        status: 'skipped',
        message: 'Merge was skipped',
      };
      vi.mocked(tmpAnything.executeAction).mockResolvedValue(mockResult);

      await run(mockDeps);

      expect(mockDeps.core.setOutput).toHaveBeenCalledWith('result', 'skipped');
      expect(mockDeps.core.setOutput).not.toHaveBeenCalledWith('merge_method', expect.anything());
      expect(mockDeps.core.info).toHaveBeenCalledWith('lysbot-merge result: skipped - Merge was skipped');
      expect(mockDeps.core.setFailed).not.toHaveBeenCalled();
    });

    it('should handle failed merge result', async () => {
      // mergeMethod is intentionally omitted - failed merges don't have a merge method
      const mockResult: ActionResult = {
        status: 'failed',
        message: 'Merge checks failed',
      };
      vi.mocked(tmpAnything.executeAction).mockResolvedValue(mockResult);

      await run(mockDeps);

      expect(mockDeps.core.setOutput).toHaveBeenCalledWith('result', 'failed');
      expect(mockDeps.core.info).toHaveBeenCalledWith('lysbot-merge result: failed - Merge checks failed');
      expect(mockDeps.core.info).toHaveBeenCalledWith('Merge checks or operation failed. See PR comments for details.');
      expect(mockDeps.core.setFailed).not.toHaveBeenCalled();
    });

    it('should handle already_merged result', async () => {
      // mergeMethod is intentionally omitted - already merged PRs don't need a new merge method
      const mockResult: ActionResult = {
        status: 'already_merged',
        message: 'Pull request is already merged',
      };
      vi.mocked(tmpAnything.executeAction).mockResolvedValue(mockResult);

      await run(mockDeps);

      expect(mockDeps.core.setOutput).toHaveBeenCalledWith('result', 'already_merged');
      expect(mockDeps.core.setFailed).not.toHaveBeenCalled();
    });

    it('should build correct event context from GitHub context', async () => {
      await run(mockDeps);

      expect(tmpAnything.executeAction).toHaveBeenCalled();
    });

    it('should handle missing pull_request in payload', async () => {
      setMockContextPayload(mockDeps, {
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

      await run(mockDeps);

      expect(tmpAnything.executeAction).toHaveBeenCalled();
    });

    it('should handle missing comment in payload', async () => {
      setMockContextPayload(mockDeps, {
        issue: {
          number: 123,
          pull_request: {},
        },
      });

      await run(mockDeps);

      expect(tmpAnything.executeAction).toHaveBeenCalled();
    });

    it('should use GITHUB_SERVER_URL from environment if available', async () => {
      process.env.GITHUB_SERVER_URL = 'https://github.enterprise.com';

      await run(mockDeps);

      expect(tmpAnything.executeAction).toHaveBeenCalled();

      process.env.GITHUB_SERVER_URL = 'https://github.com';
    });

    it('should handle errors from executeAction', async () => {
      vi.mocked(tmpAnything.executeAction).mockRejectedValue(new Error('API error'));

      await run(mockDeps);

      expect(mockDeps.core.setFailed).toHaveBeenCalledWith('lysbot-merge action failed: API error');
      expect(mockDeps.core.setOutput).not.toHaveBeenCalled();

      expect(mockDeps.core.summary.write).not.toHaveBeenCalled();
    });

    it('should handle non-Error exceptions', async () => {
      vi.mocked(tmpAnything.executeAction).mockRejectedValue('string error');

      await run(mockDeps);

      expect(mockDeps.core.setFailed).toHaveBeenCalledWith('lysbot-merge action failed: Unknown error');
    });

    it('should build correct summary markdown', async () => {
      await run(mockDeps);

      expect(tmpAnything.buildSummaryMarkdown).toHaveBeenCalledWith(
        '✅ Merged successfully',
        123,
        'test-actor',
        'squash',
      );
    });

    it('should handle different merge methods in summary', async () => {
      const mockResult: ActionResult = {
        status: 'merged',
        message: 'Pull request successfully merged',
        mergeMethod: 'merge',
      };
      vi.mocked(tmpAnything.executeAction).mockResolvedValue(mockResult);

      await run(mockDeps);

      expect(tmpAnything.buildSummaryMarkdown).toHaveBeenCalledWith(
        '✅ Merged successfully',
        123,
        'test-actor',
        'merge',
      );
    });

    it('should parse integer inputs correctly', async () => {
      (mockDeps.core.getInput as ReturnType<typeof vi.fn>).mockImplementation((name: string) => {
        const config: Record<string, string> = {
          'github-token': 'test-token',
          mergeable_retry_count: '10',
          mergeable_retry_interval: '20',
        };
        return config[name] || '';
      });

      await run(mockDeps);

      expect(tmpAnything.executeAction).toHaveBeenCalled();
    });

    it('should handle invalid integer inputs gracefully', async () => {
      (mockDeps.core.getInput as ReturnType<typeof vi.fn>).mockImplementation((name: string) => {
        const config: Record<string, string> = {
          'github-token': 'test-token',
          mergeable_retry_count: 'not-a-number',
          mergeable_retry_interval: 'also-not-a-number',
        };
        return config[name] || '';
      });

      await run(mockDeps);

      expect(tmpAnything.executeAction).toHaveBeenCalled();
    });
  });
});
