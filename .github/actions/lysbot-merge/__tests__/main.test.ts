import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

vi.mock('@actions/core', () => mockCore);
vi.mock('@actions/github', () => mockGithub);

const { run } = await import('../../../src/main.js');

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
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should execute successfully with mocked dependencies', async () => {
    /* eslint-disable-next-line @typescript-eslint/no-unsafe-call */
    await run();

    expect(mockCore.getInput).toHaveBeenCalledWith('github-token', { required: true });
    expect(mockGithub.getOctokit).toHaveBeenCalledWith('test-token');
  });

  it('should handle errors gracefully', async () => {
    mockCore.getInput.mockImplementation(() => {
      throw new Error('Test error');
    });

    /* eslint-disable-next-line @typescript-eslint/no-unsafe-call */
    await run();

    expect(mockCore.setFailed).toHaveBeenCalled();
  });
});
