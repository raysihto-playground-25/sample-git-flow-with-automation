/**
 * main.test.ts - Tests for main.ts module
 *
 * Tests cover the run() function which is the main entry point for the GitHub Action.
 * This module tests the GitHub Actions runtime integration code using Dependency
 * Injection (DI) to provide test doubles.
 *
 * TESTING APPROACH:
 * =================
 * Instead of using vi.mock to intercept module imports, this test suite uses
 * Dependency Injection (DI) to inject test doubles directly into the run() function.
 * This approach provides:
 * - Explicit dependencies without hidden module mocks
 * - Better type safety through TypeScript interfaces
 * - Testability built into the code structure (DIP - Dependency Inversion Principle)
 * - Easier to understand and maintain tests
 */

import { describe, expect, it, vi, beforeEach, afterEach, type Mock } from 'vitest';

import * as action from '../src/action.js';
import { run } from '../src/main.js';
import type {
  ActionsCore,
  GetOctokitFunction,
  GitHubContext,
  Octokit,
  RunDependencies,
  RuntimeEnvironment,
  ActionConfig,
  EventContext,
} from '../src/types.js';

/**
 * Creates a mock ActionsCore implementation for testing.
 * Only includes the methods actually used by the code.
 */
function createMockCore(): ActionsCore {
  const mockSummary = {
    addRaw: vi.fn().mockReturnValue({
      write: vi.fn().mockResolvedValue(undefined),
    }),
  };
  return {
    getInput: vi.fn(),
    setOutput: vi.fn(),
    setFailed: vi.fn(),
    info: vi.fn(),
    summary: mockSummary,
  };
}

/**
 * Creates a mock GitHubContext for testing.
 */
function createMockContext(overrides: Partial<GitHubContext> = {}): GitHubContext {
  return {
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
    ...overrides,
  };
}

/**
 * Creates a mock Octokit instance for testing.
 */
function createMockOctokit(): Octokit {
  return {
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
      repos: {
        getCollaboratorPermissionLevel: vi.fn(),
      },
    },
    paginate: vi.fn(),
    graphql: vi.fn(),
  } as unknown as Octokit;
}

/**
 * Creates a mock getOctokit function for testing.
 * This is the actual function, not a wrapper object.
 */
function createMockGetOctokit(octokit: Octokit): GetOctokitFunction {
  return vi.fn().mockReturnValue(octokit) as GetOctokitFunction;
}

/**
 * Creates a mock RuntimeEnvironment for testing.
 */
function createMockEnv(overrides?: Partial<RuntimeEnvironment>): RuntimeEnvironment {
  return {
    serverUrl: 'https://github.com',
    ...overrides,
  };
}

describe('main.ts', () => {
  describe('run()', () => {
    // Shared test fixtures
    let mockCore: ActionsCore;
    let mockContext: GitHubContext;
    let mockOctokit: Octokit;
    let mockGetOctokit: GetOctokitFunction;
    let mockEnv: RuntimeEnvironment;
    let deps: RunDependencies;

    /**
     * Helper to create standard test dependencies
     */
    function setupStandardDeps(): void {
      mockCore = createMockCore();
      mockContext = createMockContext();
      mockOctokit = createMockOctokit();
      mockGetOctokit = createMockGetOctokit(mockOctokit);
      mockEnv = createMockEnv();
      deps = {
        core: mockCore,
        context: mockContext,
        getOctokit: mockGetOctokit,
        env: mockEnv,
      };
    }

    beforeEach(() => {
      setupStandardDeps();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should successfully execute with default configuration', async () => {
      // Arrange: Mock core.getInput to return default config
      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        if (name === 'github-token') {
          return 'test-token';
        }
        return '';
      });

      // Spy on action module functions
      const executeActionSpy = vi.spyOn(action, 'executeAction').mockResolvedValue({
        status: 'merged',
        message: 'Pull request successfully merged',
        mergeMethod: 'squash',
      });

      const buildSummaryMarkdownSpy = vi.spyOn(action, 'buildSummaryMarkdown').mockReturnValue('# Test Summary');

      // Act
      await run(deps);

      // Assert
      expect(mockCore.getInput).toHaveBeenCalledWith('github-token', { required: true });
      expect(mockGetOctokit).toHaveBeenCalledWith('test-token');
      expect(executeActionSpy).toHaveBeenCalled();
      expect(mockCore.setOutput).toHaveBeenCalledWith('result', 'merged');
      expect(mockCore.setOutput).toHaveBeenCalledWith('merge_method', 'squash');
      expect(buildSummaryMarkdownSpy).toHaveBeenCalled();
      expect(mockCore.summary.addRaw).toHaveBeenCalledWith('# Test Summary');
      expect(mockCore.info).toHaveBeenCalledWith('lysbot-merge result: merged - Pull request successfully merged');
      expect(mockCore.setFailed).not.toHaveBeenCalled();
    });

    it('should handle custom configuration inputs', async () => {
      // Arrange

      // Mock custom configuration
      (mockCore.getInput as Mock).mockImplementation((name: string) => {
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

      const executeActionSpy = vi.spyOn(action, 'executeAction').mockResolvedValue({
        status: 'merged',
        message: 'Pull request successfully merged',
        mergeMethod: 'squash',
      });

      vi.spyOn(action, 'buildSummaryMarkdown').mockReturnValue('# Summary');

      // Act
      await run(deps);

      // Assert
      expect(executeActionSpy).toHaveBeenCalledWith(
        expect.any(Object), // octokit
        expect.any(Object), // context
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
      // Arrange

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        if (name === 'github-token') {
          return 'test-token';
        }
        return '';
      });

      const executeActionSpy = vi.spyOn(action, 'executeAction').mockResolvedValue({
        status: 'merged',
        message: 'Success',
        mergeMethod: 'squash',
      });

      vi.spyOn(action, 'buildSummaryMarkdown').mockReturnValue('# Summary');

      // Act
      await run(deps);

      // Assert
      expect(executeActionSpy).toHaveBeenCalled();
    });

    it('should handle skipped merge result', async () => {
      // Arrange

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        if (name === 'github-token') {
          return 'test-token';
        }
        return '';
      });

      vi.spyOn(action, 'executeAction').mockResolvedValue({
        status: 'skipped',
        message: 'Merge was skipped',
        // mergeMethod omitted
      });

      vi.spyOn(action, 'buildSummaryMarkdown').mockReturnValue('# Summary');

      // Act
      await run(deps);

      // Assert
      expect(mockCore.setOutput).toHaveBeenCalledWith('result', 'skipped');
      expect(mockCore.setOutput).not.toHaveBeenCalledWith('merge_method', expect.anything());
      expect(mockCore.info).toHaveBeenCalledWith('lysbot-merge result: skipped - Merge was skipped');
      expect(mockCore.setFailed).not.toHaveBeenCalled();
    });

    it('should handle failed merge result', async () => {
      // Arrange

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        if (name === 'github-token') {
          return 'test-token';
        }
        return '';
      });

      vi.spyOn(action, 'executeAction').mockResolvedValue({
        status: 'failed',
        message: 'Merge checks failed',
        // mergeMethod omitted
      });

      vi.spyOn(action, 'buildSummaryMarkdown').mockReturnValue('# Summary');

      // Act
      await run(deps);

      // Assert
      expect(mockCore.setOutput).toHaveBeenCalledWith('result', 'failed');
      expect(mockCore.info).toHaveBeenCalledWith('lysbot-merge result: failed - Merge checks failed');
      expect(mockCore.info).toHaveBeenCalledWith('Merge checks or operation failed. See PR comments for details.');
      expect(mockCore.setFailed).not.toHaveBeenCalled();
    });

    it('should handle already_merged result', async () => {
      // Arrange

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        if (name === 'github-token') {
          return 'test-token';
        }
        return '';
      });

      vi.spyOn(action, 'executeAction').mockResolvedValue({
        status: 'already_merged',
        message: 'Pull request is already merged',
        // mergeMethod omitted
      });

      vi.spyOn(action, 'buildSummaryMarkdown').mockReturnValue('# Summary');

      // Act
      await run(deps);

      // Assert
      expect(mockCore.setOutput).toHaveBeenCalledWith('result', 'already_merged');
      expect(mockCore.setFailed).not.toHaveBeenCalled();
    });

    it('should handle missing pull_request in payload', async () => {
      // Arrange: Override context with custom payload
      mockContext = createMockContext({
        payload: {
          issue: {
            number: 123,
          },
          comment: {
            id: 456,
            body: '/lysbot merge',
            user: { type: 'User' },
            author_association: 'MEMBER',
          },
        },
      });
      deps = {
        core: mockCore,
        context: mockContext,
        getOctokit: mockGetOctokit,
        env: mockEnv,
      };

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        if (name === 'github-token') {
          return 'test-token';
        }
        return '';
      });

      const executeActionSpy = vi.spyOn(action, 'executeAction').mockResolvedValue({
        status: 'skipped',
        message: 'Not a PR',
        // mergeMethod omitted
      });

      vi.spyOn(action, 'buildSummaryMarkdown').mockReturnValue('# Summary');

      // Act
      await run(deps);

      // Assert
      expect(executeActionSpy).toHaveBeenCalled();
    });

    it('should handle missing comment in payload', async () => {
      // Arrange: Override context with custom payload
      mockContext = createMockContext({
        payload: {
          issue: {
            number: 123,
            pull_request: {},
          },
        },
      });
      deps = {
        core: mockCore,
        context: mockContext,
        getOctokit: mockGetOctokit,
        env: mockEnv,
      };

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        if (name === 'github-token') {
          return 'test-token';
        }
        return '';
      });

      const executeActionSpy = vi.spyOn(action, 'executeAction').mockResolvedValue({
        status: 'skipped',
        message: 'No comment',
        // mergeMethod omitted
      });

      vi.spyOn(action, 'buildSummaryMarkdown').mockReturnValue('# Summary');

      // Act
      await run(deps);

      // Assert
      expect(executeActionSpy).toHaveBeenCalled();
    });

    it('should use custom serverUrl from environment', async () => {
      // Arrange: Override environment with custom serverUrl
      mockEnv = createMockEnv({ serverUrl: 'https://github.enterprise.com' });
      deps = {
        core: mockCore,
        context: mockContext,
        getOctokit: mockGetOctokit,
        env: mockEnv,
      };

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        if (name === 'github-token') {
          return 'test-token';
        }
        return '';
      });

      const executeActionSpy = vi.spyOn(action, 'executeAction').mockResolvedValue({
        status: 'merged',
        message: 'Success',
        mergeMethod: 'squash',
      });

      vi.spyOn(action, 'buildSummaryMarkdown').mockReturnValue('# Summary');

      // Act
      await run(deps);

      // Assert
      expect(executeActionSpy).toHaveBeenCalled();
      const callArgs = executeActionSpy.mock.calls[0] as [unknown, EventContext, ActionConfig];
      if (callArgs) {
        expect(callArgs[1]).toMatchObject({
          serverUrl: 'https://github.enterprise.com',
        });
      }
    });

    it('should handle errors from executeAction', async () => {
      // Arrange

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        if (name === 'github-token') {
          return 'test-token';
        }
        return '';
      });

      vi.spyOn(action, 'executeAction').mockRejectedValue(new Error('API error'));

      // Act
      await run(deps);

      // Assert
      expect(mockCore.setFailed).toHaveBeenCalledWith('lysbot-merge action failed: API error');
      expect(mockCore.setOutput).not.toHaveBeenCalled();
    });

    it('should handle non-Error exceptions', async () => {
      // Arrange

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        if (name === 'github-token') {
          return 'test-token';
        }
        return '';
      });

      vi.spyOn(action, 'executeAction').mockRejectedValue('string error');

      // Act
      await run(deps);

      // Assert
      expect(mockCore.setFailed).toHaveBeenCalledWith('lysbot-merge action failed: Unknown error');
    });

    it('should build correct summary markdown', async () => {
      // Arrange

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        if (name === 'github-token') {
          return 'test-token';
        }
        return '';
      });

      vi.spyOn(action, 'executeAction').mockResolvedValue({
        status: 'merged',
        message: 'Success',
        mergeMethod: 'squash',
      });

      const buildSummaryMarkdownSpy = vi.spyOn(action, 'buildSummaryMarkdown').mockReturnValue('# Test Summary');

      // Act
      await run(deps);

      // Assert
      expect(buildSummaryMarkdownSpy).toHaveBeenCalledWith('✅ Merged successfully', 123, 'test-actor', 'squash');
    });

    it('should handle different merge methods in summary', async () => {
      // Arrange

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        if (name === 'github-token') {
          return 'test-token';
        }
        return '';
      });

      vi.spyOn(action, 'executeAction').mockResolvedValue({
        status: 'merged',
        message: 'Success',
        mergeMethod: 'merge',
      });

      const buildSummaryMarkdownSpy = vi.spyOn(action, 'buildSummaryMarkdown').mockReturnValue('# Test Summary');

      // Act
      await run(deps);

      // Assert
      expect(buildSummaryMarkdownSpy).toHaveBeenCalledWith('✅ Merged successfully', 123, 'test-actor', 'merge');
    });

    it('should parse integer inputs correctly', async () => {
      // Arrange

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        const config: Record<string, string> = {
          'github-token': 'test-token',
          mergeable_retry_count: '10',
          mergeable_retry_interval: '20',
        };
        return config[name] || '';
      });

      const executeActionSpy = vi.spyOn(action, 'executeAction').mockResolvedValue({
        status: 'merged',
        message: 'Success',
        mergeMethod: 'squash',
      });

      vi.spyOn(action, 'buildSummaryMarkdown').mockReturnValue('# Summary');

      // Act
      await run(deps);

      // Assert
      expect(executeActionSpy).toHaveBeenCalled();
    });

    it('should reject invalid integer inputs with clear error message', async () => {
      // Arrange

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        const config: Record<string, string> = {
          'github-token': 'test-token',
          mergeable_retry_count: 'not-a-number',
          mergeable_retry_interval: '10',
        };
        return config[name] || '';
      });

      // Act
      await run(deps);

      // Assert: Action should fail with clear error message
      expect(mockCore.setFailed).toHaveBeenCalledWith(
        expect.stringContaining(
          'lysbot-merge action failed: Invalid mergeable_retry_count: "not-a-number" is not a valid integer',
        ),
      );
      expect(mockCore.setFailed).toHaveBeenCalledWith(expect.stringContaining('Must be between 1 and 20'));
    });

    it('should reject negative retry count with clear error message', async () => {
      // Arrange

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        const config: Record<string, string> = {
          'github-token': 'test-token',
          mergeable_retry_count: '-5',
          mergeable_retry_interval: '10',
        };
        return config[name] || '';
      });

      await run(deps);

      expect(mockCore.setFailed).toHaveBeenCalledWith(
        expect.stringMatching(
          /lysbot-merge action failed: Invalid mergeable_retry_count: -5 is out of range[\s\S]*Must be between 1 and 20/,
        ),
      );
    });

    it('should reject excessive retry values with clear error message', async () => {
      // Arrange

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        const config: Record<string, string> = {
          'github-token': 'test-token',
          mergeable_retry_count: '100', // > max 20
          mergeable_retry_interval: '10',
        };
        return config[name] || '';
      });

      await run(deps);

      expect(mockCore.setFailed).toHaveBeenCalledWith(
        expect.stringMatching(
          /lysbot-merge action failed: Invalid mergeable_retry_count: 100 is out of range[\s\S]*Must be between 1 and 20/,
        ),
      );
    });

    it('should accept boundary values within valid range', async () => {
      // Arrange

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        const config: Record<string, string> = {
          'github-token': 'test-token',
          mergeable_retry_count: '20', // max valid
          mergeable_retry_interval: '1', // min valid
        };
        return config[name] || '';
      });

      const executeActionSpy = vi.spyOn(action, 'executeAction').mockResolvedValue({
        status: 'merged',
        message: 'Success',
      });

      vi.spyOn(action, 'buildSummaryMarkdown').mockReturnValue('# Summary');

      await run(deps);

      const callArgs = executeActionSpy.mock.calls[0] as [unknown, EventContext, ActionConfig];
      const config: ActionConfig = callArgs[2];

      expect(config.mergeableRetryCount).toBe(20); // max boundary accepted
      expect(config.mergeableRetryInterval).toBe(1); // min boundary accepted
    });

    it('should reject invalid mergeable_retry_interval with clear error message', async () => {
      // Arrange

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        const config: Record<string, string> = {
          'github-token': 'test-token',
          mergeable_retry_count: '5',
          mergeable_retry_interval: 'not-a-number',
        };
        return config[name] || '';
      });

      await run(deps);

      expect(mockCore.setFailed).toHaveBeenCalledWith(
        expect.stringMatching(
          /lysbot-merge action failed: Invalid mergeable_retry_interval: "not-a-number" is not a valid integer[\s\S]*Must be between 1 and 60/,
        ),
      );
    });

    it('should reject out-of-range mergeable_retry_interval (too small)', async () => {
      // Arrange

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        const config: Record<string, string> = {
          'github-token': 'test-token',
          mergeable_retry_count: '5',
          mergeable_retry_interval: '0',
        };
        return config[name] || '';
      });

      await run(deps);

      expect(mockCore.setFailed).toHaveBeenCalledWith(
        expect.stringMatching(
          /lysbot-merge action failed: Invalid mergeable_retry_interval: 0 is out of range[\s\S]*Must be between 1 and 60/,
        ),
      );
    });

    it('should reject out-of-range mergeable_retry_interval (too large)', async () => {
      // Arrange

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        const config: Record<string, string> = {
          'github-token': 'test-token',
          mergeable_retry_count: '5',
          mergeable_retry_interval: '61',
        };
        return config[name] || '';
      });

      await run(deps);

      expect(mockCore.setFailed).toHaveBeenCalledWith(
        expect.stringMatching(
          /lysbot-merge action failed: Invalid mergeable_retry_interval: 61 is out of range[\s\S]*Must be between 1 and 60/,
        ),
      );
    });

    it('should log stack trace when error with stack is thrown', async () => {
      // Arrange

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        if (name === 'github-token') {
          return 'test-token';
        }
        return '';
      });

      // Setup spy to throw error with stack trace
      vi.spyOn(action, 'executeAction').mockImplementation(() => {
        const error = new Error('Test error with stack');
        error.stack = 'Error: Test error with stack\n    at TestLocation (test.ts:123:45)';
        throw error;
      });

      await run(deps);

      expect(mockCore.setFailed).toHaveBeenCalledWith('lysbot-merge action failed: Test error with stack');
      expect(mockCore.info).toHaveBeenCalledWith(expect.stringContaining('Stack trace: Error: Test error with stack'));
      expect(mockCore.info).toHaveBeenCalledWith(expect.stringContaining('at TestLocation (test.ts:123:45)'));
    });
  });
});
