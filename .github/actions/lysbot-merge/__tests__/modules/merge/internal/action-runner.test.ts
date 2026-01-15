import { beforeEach, describe, expect, it } from 'vitest';

import { DefaultActionRunner } from '../../../../src/modules/merge/internal/action-runner.js';
import type { MergeService } from '../../../../src/modules/merge/internal/merge-service.js';
import type {
  ActionConfig,
  ActionResult,
  EventContext,
  Octokit,
} from '../../../../src/modules/merge/internal/types.js';
import { createMockOctokit } from '../../../helpers/fixtures.js';
import { TestCoreAdapter, TestGitHubAdapter } from '../../../helpers/test-adapters.js';

describe('action-runner', () => {
  let coreAdapter: TestCoreAdapter;
  let githubAdapter: TestGitHubAdapter;
  let mockMergeService: MergeService;
  let runner: DefaultActionRunner;

  beforeEach(() => {
    coreAdapter = new TestCoreAdapter();
    githubAdapter = new TestGitHubAdapter();

    // Setup default inputs
    coreAdapter.setInput('github-token', 'test-token');

    // Create mock octokit
    const octokit = createMockOctokit();
    githubAdapter.setOctokit(octokit);

    // Create mock merge service
    mockMergeService = {
      executeAction: async (): Promise<ActionResult> => {
        return {
          status: 'merged',
          message: 'PR merged successfully',
          mergeMethod: 'squash',
        };
      },
    };

    runner = new DefaultActionRunner({
      core: coreAdapter,
      github: githubAdapter,
      mergeService: mockMergeService,
    });
  });

  describe('run', () => {
    it('should execute successfully with default configuration', async () => {
      await runner.run();

      expect(coreAdapter.getOutput('result')).toBe('merged');
      expect(coreAdapter.getOutput('merge_method')).toBe('squash');
      expect(coreAdapter.getFailures()).toHaveLength(0);
    });

    it('should use custom configuration inputs', async () => {
      coreAdapter.setInput('release_branch_prefix', 'rel/');
      coreAdapter.setInput('develop_branch', 'main');
      coreAdapter.setInput('sync_branch_prefix', 'sync/');
      coreAdapter.setInput('mergeable_retry_count', '3');
      coreAdapter.setInput('mergeable_retry_interval', '5');

      let capturedConfig: ActionConfig | null = null;
      mockMergeService.executeAction = async (_octokit, _context, config): Promise<ActionResult> => {
        capturedConfig = config;
        return { status: 'merged', message: 'Success', mergeMethod: 'squash' };
      };

      await runner.run();

      expect(capturedConfig).toMatchObject({
        releaseBranchPrefix: 'rel/',
        developBranch: 'main',
        syncBranchPrefix: 'sync/',
        mergeableRetryCount: 3,
        mergeableRetryInterval: 5,
      });
    });

    it('should use default values when optional inputs are empty', async () => {
      let capturedConfig: ActionConfig | null = null;
      mockMergeService.executeAction = async (
        _octokit: Octokit,
        _context: EventContext,
        config: ActionConfig,
      ): Promise<ActionResult> => {
        capturedConfig = config;
        return { status: 'merged', message: 'Success' };
      };

      await runner.run();

      expect(capturedConfig).toMatchObject({
        releaseBranchPrefix: 'release/',
        developBranch: 'develop',
        syncBranchPrefix: 'fix/sync/',
        mergeableRetryCount: 5,
        mergeableRetryInterval: 10,
      });
    });

    it('should handle skipped merge result', async () => {
      mockMergeService.executeAction = async (): Promise<ActionResult> => {
        return { status: 'skipped', message: 'Merge was skipped' };
      };

      await runner.run();

      expect(coreAdapter.getOutput('result')).toBe('skipped');
      expect(coreAdapter.getOutput('merge_method')).toBeUndefined();
      expect(coreAdapter.getInfoMessages()).toContain('lysbot-merge result: skipped - Merge was skipped');
    });

    it('should handle failed merge result', async () => {
      mockMergeService.executeAction = async (): Promise<ActionResult> => {
        return { status: 'failed', message: 'Merge checks failed' };
      };

      await runner.run();

      expect(coreAdapter.getOutput('result')).toBe('failed');
      const messages = coreAdapter.getInfoMessages();
      expect(messages).toContain('lysbot-merge result: failed - Merge checks failed');
      expect(messages).toContain('Merge checks or operation failed. See PR comments for details.');
    });

    it('should handle already_merged result', async () => {
      mockMergeService.executeAction = async (): Promise<ActionResult> => {
        return { status: 'already_merged', message: 'Pull request is already merged' };
      };

      await runner.run();

      expect(coreAdapter.getOutput('result')).toBe('already_merged');
      expect(coreAdapter.getFailures()).toHaveLength(0);
    });

    it('should build correct event context from GitHub context', async () => {
      let capturedContext: EventContext | null = null;
      mockMergeService.executeAction = async (_octokit, context): Promise<ActionResult> => {
        capturedContext = context;
        return { status: 'merged', message: 'Success' };
      };

      await runner.run();

      expect(capturedContext).toMatchObject({
        owner: 'test-owner',
        repo: 'test-repo',
        prNumber: 123,
        commentId: 999,
        commentBody: '/lysbot merge',
        actor: 'test-actor',
        userType: 'User',
        authorAssociation: 'MEMBER',
        runId: 12345,
        eventName: 'issue_comment',
        isPullRequest: true,
      });
    });

    it('should handle errors from executeAction', async () => {
      mockMergeService.executeAction = async (): Promise<ActionResult> => {
        throw new Error('API error');
      };

      await runner.run();

      const failures = coreAdapter.getFailures();
      expect(failures).toHaveLength(1);
      expect(failures[0]).toBe('lysbot-merge action failed: API error');
      expect(coreAdapter.getOutput('result')).toBeUndefined();
    });

    it('should handle non-Error exceptions', async () => {
      mockMergeService.executeAction = async (): Promise<ActionResult> => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'string error';
      };

      await runner.run();

      const failures = coreAdapter.getFailures();
      expect(failures).toHaveLength(1);
      expect(failures[0]).toBe('lysbot-merge action failed: Unknown error');
    });

    it('should build correct summary markdown', async () => {
      await runner.run();

      const summary = coreAdapter.getSummaryText();
      expect(summary).toContain('lysbot-merge Summary');
      expect(summary).toContain('✅ Merged successfully');
      expect(summary).toContain('#123');
      expect(summary).toContain('@test-actor');
      expect(summary).toContain('squash');
    });

    it('should handle different merge methods in summary', async () => {
      mockMergeService.executeAction = async (): Promise<ActionResult> => {
        return { status: 'merged', message: 'Success', mergeMethod: 'merge' };
      };

      await runner.run();

      const summary = coreAdapter.getSummaryText();
      expect(summary).toContain('merge');
    });

    it('should parse integer inputs correctly', async () => {
      coreAdapter.setInput('mergeable_retry_count', '10');
      coreAdapter.setInput('mergeable_retry_interval', '20');

      let capturedConfig: ActionConfig | null = null;
      mockMergeService.executeAction = async (
        _octokit: Octokit,
        _context: EventContext,
        config: ActionConfig,
      ): Promise<ActionResult> => {
        capturedConfig = config;
        return { status: 'merged', message: 'Success' };
      };

      await runner.run();

      expect(capturedConfig?.mergeableRetryCount).toBe(10);
      expect(capturedConfig?.mergeableRetryInterval).toBe(20);
    });

    it('should handle invalid integer inputs gracefully', async () => {
      coreAdapter.setInput('mergeable_retry_count', 'not-a-number');
      coreAdapter.setInput('mergeable_retry_interval', 'also-not-a-number');

      let capturedConfig: ActionConfig | null = null;
      mockMergeService.executeAction = async (
        _octokit: Octokit,
        _context: EventContext,
        config: ActionConfig,
      ): Promise<ActionResult> => {
        capturedConfig = config;
        return { status: 'merged', message: 'Success' };
      };

      await runner.run();

      // parseInt('not-a-number') returns NaN, which is what we expect
      expect(capturedConfig?.mergeableRetryCount).toBeNaN();
      expect(capturedConfig?.mergeableRetryInterval).toBeNaN();
    });
  });
});
