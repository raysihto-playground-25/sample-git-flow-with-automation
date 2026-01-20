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

import { describe, expect, it, vi, type Mock } from 'vitest';

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
    it('should successfully execute with default configuration', async () => {
      // Arrange: Create test doubles
      const mockCore = createMockCore();
      const mockContext = createMockContext();
      const mockOctokit = createMockOctokit();
      const mockGetOctokit = createMockGetOctokit(mockOctokit);
      const mockEnv = createMockEnv();

      // Mock core.getInput to return default config
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

      const deps: RunDependencies = {
        core: mockCore,
        context: mockContext,
        getOctokit: mockGetOctokit,
        env: mockEnv,
      };

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

      // Cleanup
      vi.restoreAllMocks();
    });

    it('should handle custom configuration inputs', async () => {
      // Arrange
      const mockCore = createMockCore();
      const mockContext = createMockContext();
      const mockOctokit = createMockOctokit();
      const mockGetOctokit = createMockGetOctokit(mockOctokit);
      const mockEnv = createMockEnv();

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

      const deps: RunDependencies = {
        core: mockCore,
        context: mockContext,
        getOctokit: mockGetOctokit,
        env: mockEnv,
      };

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

      // Cleanup
      vi.restoreAllMocks();
    });

    it('should use default values when optional inputs are empty', async () => {
      // Arrange
      const mockCore = createMockCore();
      const mockContext = createMockContext();
      const mockOctokit = createMockOctokit();
      const mockGetOctokit = createMockGetOctokit(mockOctokit);
      const mockEnv = createMockEnv();

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

      const deps: RunDependencies = {
        core: mockCore,
        context: mockContext,
        getOctokit: mockGetOctokit,
        env: mockEnv,
      };

      // Act
      await run(deps);

      // Assert
      expect(executeActionSpy).toHaveBeenCalled();

      // Cleanup
      vi.restoreAllMocks();
    });

    it('should handle skipped merge result', async () => {
      // Arrange
      const mockCore = createMockCore();
      const mockContext = createMockContext();
      const mockOctokit = createMockOctokit();
      const mockGetOctokit = createMockGetOctokit(mockOctokit);
      const mockEnv = createMockEnv();

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

      const deps: RunDependencies = {
        core: mockCore,
        context: mockContext,
        getOctokit: mockGetOctokit,
        env: mockEnv,
      };

      // Act
      await run(deps);

      // Assert
      expect(mockCore.setOutput).toHaveBeenCalledWith('result', 'skipped');
      expect(mockCore.setOutput).not.toHaveBeenCalledWith('merge_method', expect.anything());
      expect(mockCore.info).toHaveBeenCalledWith('lysbot-merge result: skipped - Merge was skipped');
      expect(mockCore.setFailed).not.toHaveBeenCalled();

      // Cleanup
      vi.restoreAllMocks();
    });

    it('should handle failed merge result', async () => {
      // Arrange
      const mockCore = createMockCore();
      const mockContext = createMockContext();
      const mockOctokit = createMockOctokit();
      const mockGetOctokit = createMockGetOctokit(mockOctokit);
      const mockEnv = createMockEnv();

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

      const deps: RunDependencies = {
        core: mockCore,
        context: mockContext,
        getOctokit: mockGetOctokit,
        env: mockEnv,
      };

      // Act
      await run(deps);

      // Assert
      expect(mockCore.setOutput).toHaveBeenCalledWith('result', 'failed');
      expect(mockCore.info).toHaveBeenCalledWith('lysbot-merge result: failed - Merge checks failed');
      expect(mockCore.info).toHaveBeenCalledWith('Merge checks or operation failed. See PR comments for details.');
      expect(mockCore.setFailed).not.toHaveBeenCalled();

      // Cleanup
      vi.restoreAllMocks();
    });

    it('should handle already_merged result', async () => {
      // Arrange
      const mockCore = createMockCore();
      const mockContext = createMockContext();
      const mockOctokit = createMockOctokit();
      const mockGetOctokit = createMockGetOctokit(mockOctokit);
      const mockEnv = createMockEnv();

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

      const deps: RunDependencies = {
        core: mockCore,
        context: mockContext,
        getOctokit: mockGetOctokit,
        env: mockEnv,
      };

      // Act
      await run(deps);

      // Assert
      expect(mockCore.setOutput).toHaveBeenCalledWith('result', 'already_merged');
      expect(mockCore.setFailed).not.toHaveBeenCalled();

      // Cleanup
      vi.restoreAllMocks();
    });

    it('should handle missing pull_request in payload', async () => {
      // Arrange
      const mockCore = createMockCore();
      const mockContext = createMockContext({
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
      const mockOctokit = createMockOctokit();
      const mockGetOctokit = createMockGetOctokit(mockOctokit);
      const mockEnv = createMockEnv();

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

      const deps: RunDependencies = {
        core: mockCore,
        context: mockContext,
        getOctokit: mockGetOctokit,
        env: mockEnv,
      };

      // Act
      await run(deps);

      // Assert
      expect(executeActionSpy).toHaveBeenCalled();

      // Cleanup
      vi.restoreAllMocks();
    });

    it('should handle missing comment in payload', async () => {
      // Arrange
      const mockCore = createMockCore();
      const mockContext = createMockContext({
        payload: {
          issue: {
            number: 123,
            pull_request: {},
          },
        },
      });
      const mockOctokit = createMockOctokit();
      const mockGetOctokit = createMockGetOctokit(mockOctokit);
      const mockEnv = createMockEnv();

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

      const deps: RunDependencies = {
        core: mockCore,
        context: mockContext,
        getOctokit: mockGetOctokit,
        env: mockEnv,
      };

      // Act
      await run(deps);

      // Assert
      expect(executeActionSpy).toHaveBeenCalled();

      // Cleanup
      vi.restoreAllMocks();
    });

    it('should use custom serverUrl from environment', async () => {
      // Arrange
      const mockCore = createMockCore();
      const mockContext = createMockContext();
      const mockOctokit = createMockOctokit();
      const mockGetOctokit = createMockGetOctokit(mockOctokit);
      const mockEnv = createMockEnv({ serverUrl: 'https://github.enterprise.com' });

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

      const deps: RunDependencies = {
        core: mockCore,
        context: mockContext,
        getOctokit: mockGetOctokit,
        env: mockEnv,
      };

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

      // Cleanup
      vi.restoreAllMocks();
    });

    it('should handle errors from executeAction', async () => {
      // Arrange
      const mockCore = createMockCore();
      const mockContext = createMockContext();
      const mockOctokit = createMockOctokit();
      const mockGetOctokit = createMockGetOctokit(mockOctokit);
      const mockEnv = createMockEnv();

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        if (name === 'github-token') {
          return 'test-token';
        }
        return '';
      });

      vi.spyOn(action, 'executeAction').mockRejectedValue(new Error('API error'));

      const deps: RunDependencies = {
        core: mockCore,
        context: mockContext,
        getOctokit: mockGetOctokit,
        env: mockEnv,
      };

      // Act
      await run(deps);

      // Assert
      expect(mockCore.setFailed).toHaveBeenCalledWith('lysbot-merge action failed: API error');
      expect(mockCore.setOutput).not.toHaveBeenCalled();

      // Cleanup
      vi.restoreAllMocks();
    });

    it('should handle non-Error exceptions', async () => {
      // Arrange
      const mockCore = createMockCore();
      const mockContext = createMockContext();
      const mockOctokit = createMockOctokit();
      const mockGetOctokit = createMockGetOctokit(mockOctokit);
      const mockEnv = createMockEnv();

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        if (name === 'github-token') {
          return 'test-token';
        }
        return '';
      });

      vi.spyOn(action, 'executeAction').mockRejectedValue('string error');

      const deps: RunDependencies = {
        core: mockCore,
        context: mockContext,
        getOctokit: mockGetOctokit,
        env: mockEnv,
      };

      // Act
      await run(deps);

      // Assert
      expect(mockCore.setFailed).toHaveBeenCalledWith('lysbot-merge action failed: Unknown error');

      // Cleanup
      vi.restoreAllMocks();
    });

    it('should build correct summary markdown', async () => {
      // Arrange
      const mockCore = createMockCore();
      const mockContext = createMockContext();
      const mockOctokit = createMockOctokit();
      const mockGetOctokit = createMockGetOctokit(mockOctokit);
      const mockEnv = createMockEnv();

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

      const deps: RunDependencies = {
        core: mockCore,
        context: mockContext,
        getOctokit: mockGetOctokit,
        env: mockEnv,
      };

      // Act
      await run(deps);

      // Assert
      expect(buildSummaryMarkdownSpy).toHaveBeenCalledWith('✅ Merged successfully', 123, 'test-actor', 'squash');

      // Cleanup
      vi.restoreAllMocks();
    });

    it('should handle different merge methods in summary', async () => {
      // Arrange
      const mockCore = createMockCore();
      const mockContext = createMockContext();
      const mockOctokit = createMockOctokit();
      const mockGetOctokit = createMockGetOctokit(mockOctokit);
      const mockEnv = createMockEnv();

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

      const deps: RunDependencies = {
        core: mockCore,
        context: mockContext,
        getOctokit: mockGetOctokit,
        env: mockEnv,
      };

      // Act
      await run(deps);

      // Assert
      expect(buildSummaryMarkdownSpy).toHaveBeenCalledWith('✅ Merged successfully', 123, 'test-actor', 'merge');

      // Cleanup
      vi.restoreAllMocks();
    });

    it('should parse integer inputs correctly', async () => {
      // Arrange
      const mockCore = createMockCore();
      const mockContext = createMockContext();
      const mockOctokit = createMockOctokit();
      const mockGetOctokit = createMockGetOctokit(mockOctokit);
      const mockEnv = createMockEnv();

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

      const deps: RunDependencies = {
        core: mockCore,
        context: mockContext,
        getOctokit: mockGetOctokit,
        env: mockEnv,
      };

      // Act
      await run(deps);

      // Assert
      expect(executeActionSpy).toHaveBeenCalled();

      // Cleanup
      vi.restoreAllMocks();
    });

    it('should handle invalid integer inputs gracefully', async () => {
      // Arrange
      const mockCore = createMockCore();
      const mockContext = createMockContext();
      const mockOctokit = createMockOctokit();
      const mockGetOctokit = createMockGetOctokit(mockOctokit);
      const mockEnv = createMockEnv();

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        const config: Record<string, string> = {
          'github-token': 'test-token',
          mergeable_retry_count: 'not-a-number',
          mergeable_retry_interval: 'also-not-a-number',
        };
        return config[name] || '';
      });

      const executeActionSpy = vi.spyOn(action, 'executeAction').mockResolvedValue({
        status: 'merged',
        message: 'Success',
        mergeMethod: 'squash',
      });

      vi.spyOn(action, 'buildSummaryMarkdown').mockReturnValue('# Summary');

      const deps: RunDependencies = {
        core: mockCore,
        context: mockContext,
        getOctokit: mockGetOctokit,
        env: mockEnv,
      };

      // Act
      await run(deps);

      // Assert: Verify executeAction was called with default values
      expect(executeActionSpy).toHaveBeenCalled();
      const callArgs = executeActionSpy.mock.calls[0] as [unknown, EventContext, ActionConfig];

      const config: ActionConfig = callArgs[2];
      // When parseInt returns NaN, config should use default values

      expect(config.mergeableRetryCount).toBe(5); // default value

      expect(config.mergeableRetryInterval).toBe(10); // default value

      // Verify the action completed successfully despite invalid inputs
      expect(mockCore.setOutput).toHaveBeenCalledWith('result', 'merged');
      expect(mockCore.setFailed).not.toHaveBeenCalled();

      // Cleanup
      vi.restoreAllMocks();
    });

    it('should handle negative retry count by using default', async () => {
      const mockCore = createMockCore();
      const mockContext = createMockContext();
      const mockOctokit = createMockOctokit();
      const mockGetOctokit = createMockGetOctokit(mockOctokit);
      const mockEnv = createMockEnv();

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        const config: Record<string, string> = {
          'github-token': 'test-token',
          mergeable_retry_count: '-5',
          mergeable_retry_interval: '10',
        };
        return config[name] || '';
      });

      const executeActionSpy = vi.spyOn(action, 'executeAction').mockResolvedValue({
        status: 'merged',
        message: 'Success',
      });

      vi.spyOn(action, 'buildSummaryMarkdown').mockReturnValue('# Summary');

      const deps: RunDependencies = {
        core: mockCore,
        context: mockContext,
        getOctokit: mockGetOctokit,
        env: mockEnv,
      };

      await run(deps);

      const callArgs = executeActionSpy.mock.calls[0] as [unknown, EventContext, ActionConfig];
      const config: ActionConfig = callArgs[2];

      expect(config.mergeableRetryCount).toBe(5); // default when negative
      expect(config.mergeableRetryInterval).toBe(10); // valid value unchanged

      vi.restoreAllMocks();
    });

    it('should handle excessive retry values by using default', async () => {
      const mockCore = createMockCore();
      const mockContext = createMockContext();
      const mockOctokit = createMockOctokit();
      const mockGetOctokit = createMockGetOctokit(mockOctokit);
      const mockEnv = createMockEnv();

      (mockCore.getInput as Mock).mockImplementation((name: string) => {
        const config: Record<string, string> = {
          'github-token': 'test-token',
          mergeable_retry_count: '100', // > max 20
          mergeable_retry_interval: '120', // > max 60
        };
        return config[name] || '';
      });

      const executeActionSpy = vi.spyOn(action, 'executeAction').mockResolvedValue({
        status: 'merged',
        message: 'Success',
      });

      vi.spyOn(action, 'buildSummaryMarkdown').mockReturnValue('# Summary');

      const deps: RunDependencies = {
        core: mockCore,
        context: mockContext,
        getOctokit: mockGetOctokit,
        env: mockEnv,
      };

      await run(deps);

      const callArgs = executeActionSpy.mock.calls[0] as [unknown, EventContext, ActionConfig];
      const config: ActionConfig = callArgs[2];

      expect(config.mergeableRetryCount).toBe(5); // default when > 20
      expect(config.mergeableRetryInterval).toBe(10); // default when > 60

      vi.restoreAllMocks();
    });

    it('should accept boundary values within valid range', async () => {
      const mockCore = createMockCore();
      const mockContext = createMockContext();
      const mockOctokit = createMockOctokit();
      const mockGetOctokit = createMockGetOctokit(mockOctokit);
      const mockEnv = createMockEnv();

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

      const deps: RunDependencies = {
        core: mockCore,
        context: mockContext,
        getOctokit: mockGetOctokit,
        env: mockEnv,
      };

      await run(deps);

      const callArgs = executeActionSpy.mock.calls[0] as [unknown, EventContext, ActionConfig];
      const config: ActionConfig = callArgs[2];

      expect(config.mergeableRetryCount).toBe(20); // max boundary accepted
      expect(config.mergeableRetryInterval).toBe(1); // min boundary accepted

      vi.restoreAllMocks();
    });
  });
});
