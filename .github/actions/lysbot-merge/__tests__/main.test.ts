/**
 * main.test.ts - Tests for main.ts entry point
 *
 * Tests the GitHub Actions runtime integration logic, specifically:
 * - Deprecated input handling and warnings
 * - Options parsing with deprecated inputs
 * - Error handling
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
        number: 42,
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

const mockParseOptions = vi.fn().mockReturnValue({
  releaseBranchPrefix: 'release/',
  developBranch: 'develop',
  syncBranchPrefix: 'fix/sync/',
  mergeableRetryCount: 5,
  mergeableRetryInterval: 10,
});

vi.mock('@actions/core', () => mockCore);
vi.mock('@actions/github', () => mockGithub);
vi.mock('../src/action.js', () => ({
  executeAction: mockExecuteAction,
  buildSummaryMarkdown: mockBuildSummaryMarkdown,
}));
vi.mock('../src/options-parser.js', () => ({
  parseOptions: mockParseOptions,
}));

// Import after mocks are set up
const { run } = await import('../src/main.js');

describe('main.ts', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();

    // Set default environment
    process.env.GITHUB_SERVER_URL = 'https://github.com';

    // Default input values
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'github-token') return 'test-token';
      return '';
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('deprecated inputs handling', () => {
    it('should show warning when release-branch-prefix deprecated input is used', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'github-token') return 'test-token';
        if (name === 'release-branch-prefix') return 'custom-release/';
        return '';
      });

      await run();

      expect(mockCore.warning).toHaveBeenCalledWith(
        'The "release-branch-prefix" input is deprecated and will be removed in a future version. ' +
          'Please use the "options" parameter with "release-branch-prefix" key instead.',
      );
      expect(mockParseOptions).toHaveBeenCalledWith('', {
        releaseBranchPrefix: 'custom-release/',
      });
    });

    it('should show warning when develop-branch deprecated input is used', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'github-token') return 'test-token';
        if (name === 'develop-branch') return 'main';
        return '';
      });

      await run();

      expect(mockCore.warning).toHaveBeenCalledWith(
        'The "develop-branch" input is deprecated and will be removed in a future version. ' +
          'Please use the "options" parameter with "develop-branch" key instead.',
      );
      expect(mockParseOptions).toHaveBeenCalledWith('', {
        developBranch: 'main',
      });
    });

    it('should show warning when sync-branch-prefix deprecated input is used', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'github-token') return 'test-token';
        if (name === 'sync-branch-prefix') return 'sync/';
        return '';
      });

      await run();

      expect(mockCore.warning).toHaveBeenCalledWith(
        'The "sync-branch-prefix" input is deprecated and will be removed in a future version. ' +
          'Please use the "options" parameter with "sync-branch-prefix" key instead.',
      );
      expect(mockParseOptions).toHaveBeenCalledWith('', {
        syncBranchPrefix: 'sync/',
      });
    });

    it('should show warning and parse integer when mergeable-retry-count deprecated input is used', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'github-token') return 'test-token';
        if (name === 'mergeable-retry-count') return '10';
        return '';
      });

      await run();

      expect(mockCore.warning).toHaveBeenCalledWith(
        'The "mergeable-retry-count" input is deprecated and will be removed in a future version. ' +
          'Please use the "options" parameter with "mergeable-retry-count" key instead.',
      );
      expect(mockParseOptions).toHaveBeenCalledWith('', {
        mergeableRetryCount: 10,
      });
    });

    it('should show warning and parse integer when mergeable-retry-interval deprecated input is used', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'github-token') return 'test-token';
        if (name === 'mergeable-retry-interval') return '15';
        return '';
      });

      await run();

      expect(mockCore.warning).toHaveBeenCalledWith(
        'The "mergeable-retry-interval" input is deprecated and will be removed in a future version. ' +
          'Please use the "options" parameter with "mergeable-retry-interval" key instead.',
      );
      expect(mockParseOptions).toHaveBeenCalledWith('', {
        mergeableRetryInterval: 15,
      });
    });

    it('should handle multiple deprecated inputs and show multiple warnings', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'github-token') return 'test-token';
        if (name === 'release-branch-prefix') return 'rel/';
        if (name === 'develop-branch') return 'main';
        if (name === 'mergeable-retry-count') return '3';
        return '';
      });

      await run();

      expect(mockCore.warning).toHaveBeenCalledTimes(3);
      expect(mockParseOptions).toHaveBeenCalledWith('', {
        releaseBranchPrefix: 'rel/',
        developBranch: 'main',
        mergeableRetryCount: 3,
      });
    });

    it('should skip invalid numeric values for retry count', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'github-token') return 'test-token';
        if (name === 'mergeable-retry-count') return 'not-a-number';
        return '';
      });

      await run();

      expect(mockCore.warning).toHaveBeenCalledWith(
        'The "mergeable-retry-count" input is deprecated and will be removed in a future version. ' +
          'Please use the "options" parameter with "mergeable-retry-count" key instead.',
      );
      // Should not include mergeableRetryCount since parsing failed
      expect(mockParseOptions).toHaveBeenCalledWith('', undefined);
    });

    it('should skip invalid numeric values for retry interval', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'github-token') return 'test-token';
        if (name === 'mergeable-retry-interval') return 'invalid';
        return '';
      });

      await run();

      expect(mockCore.warning).toHaveBeenCalledWith(
        'The "mergeable-retry-interval" input is deprecated and will be removed in a future version. ' +
          'Please use the "options" parameter with "mergeable-retry-interval" key instead.',
      );
      // Should not include mergeableRetryInterval since parsing failed
      expect(mockParseOptions).toHaveBeenCalledWith('', undefined);
    });
  });

  describe('options parameter handling', () => {
    it('should parse options YAML without deprecated inputs', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'github-token') return 'test-token';
        if (name === 'options') return 'release-branch-prefix: custom/\ndevelop-branch: dev';
        return '';
      });

      await run();

      expect(mockCore.warning).not.toHaveBeenCalled();
      expect(mockParseOptions).toHaveBeenCalledWith('release-branch-prefix: custom/\ndevelop-branch: dev', undefined);
    });

    it('should parse options YAML with deprecated inputs as fallback', async () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'github-token') return 'test-token';
        if (name === 'options') return 'release-branch-prefix: from-yaml/';
        if (name === 'develop-branch') return 'from-deprecated';
        return '';
      });

      await run();

      expect(mockCore.warning).toHaveBeenCalledTimes(1);
      expect(mockParseOptions).toHaveBeenCalledWith('release-branch-prefix: from-yaml/', {
        developBranch: 'from-deprecated',
      });
    });

    it('should use empty string for options when not provided', async () => {
      await run();

      expect(mockParseOptions).toHaveBeenCalledWith('', undefined);
    });
  });

  describe('action execution', () => {
    it('should execute action and set outputs', async () => {
      mockExecuteAction.mockResolvedValueOnce({
        status: 'merged',
        message: 'Successfully merged',
        mergeMethod: 'squash',
      });

      await run();

      expect(mockExecuteAction).toHaveBeenCalled();
      expect(mockCore.setOutput).toHaveBeenCalledWith('result', 'merged');
      expect(mockCore.setOutput).toHaveBeenCalledWith('merge_method', 'squash');
    });

    it('should not set merge_method output when null', async () => {
      mockExecuteAction.mockResolvedValueOnce({
        status: 'skipped',
        message: 'Skipped',
        mergeMethod: null,
      });

      await run();

      expect(mockCore.setOutput).toHaveBeenCalledWith('result', 'skipped');
      expect(mockCore.setOutput).not.toHaveBeenCalledWith('merge_method', expect.anything());
    });

    it('should write summary', async () => {
      await run();

      expect(mockBuildSummaryMarkdown).toHaveBeenCalled();
      expect(mockCore.summary.addRaw).toHaveBeenCalledWith('# Summary');
      expect(mockCore.summary.write).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle errors and set failed status', async () => {
      mockParseOptions.mockImplementationOnce(() => {
        throw new Error('Invalid YAML');
      });

      await run();

      expect(mockCore.setFailed).toHaveBeenCalledWith('lysbot-merge action failed: Invalid YAML');
    });

    it('should handle non-Error exceptions', async () => {
      mockParseOptions.mockImplementationOnce(() => {
        throw 'String error';
      });

      await run();

      expect(mockCore.setFailed).toHaveBeenCalledWith('lysbot-merge action failed: Unknown error');
    });
  });
});
