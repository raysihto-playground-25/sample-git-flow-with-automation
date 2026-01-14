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
        listReviews: vi.fn(),
        listCommits: vi.fn(),
        dismissReview: vi.fn(),
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
  }),
};

vi.mock('@actions/core', () => mockCore);
vi.mock('@actions/github', () => mockGithub);

const { main } = await import('../src/main.js');

function setMockContextPayload(payload: Record<string, unknown>): void {
  const ctx = mockGithub.context as { payload: unknown };
  ctx.payload = payload;
}

describe('main()', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    process.env.GITHUB_SERVER_URL = 'https://github.com';

    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'github-token') {
        return 'test-token';
      }
      return '';
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const mockOctokit = mockGithub.getOctokit('test-token');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (mockOctokit.rest.pulls.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        state: 'open',
        locked: false,
        draft: false,
        merged: false,
        mergeable: true,
        mergeable_state: 'clean',
        head: {
          sha: 'abc1234567890',
          ref: 'feature/test',
          repo: { fork: false, owner: { id: 1 } },
        },
        base: {
          ref: 'develop',
          repo: { owner: { id: 1 } },
        },
        user: { login: 'testuser' },
        title: 'feat: test pull request',
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (mockOctokit.rest.repos.getCollaboratorPermissionLevel as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { permission: 'write' },
    });

    let paginateCalls = 0;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-misused-promises
    (mockOctokit.paginate as ReturnType<typeof vi.fn>).mockImplementation(() => {
      paginateCalls++;
      if (paginateCalls === 1) {
        // First call: fetchApprovedReviews
        return Promise.resolve([
          {
            id: 1,
            state: 'APPROVED',
            commit_id: 'abc1234567890',
            user: { login: 'reviewer' },
          },
        ]);
      }
      // Second call: fetchPullRequestCommits
      return Promise.resolve([{ commit: { message: 'feat: add feature' } }]);
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (mockOctokit.graphql as ReturnType<typeof vi.fn>).mockResolvedValue({
      repository: {
        pullRequest: {
          reviewThreads: {
            pageInfo: { hasNextPage: false, endCursor: null },
            nodes: [],
          },
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    (mockOctokit.rest.pulls.merge as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: { sha: 'merge123456789', merged: true, message: 'Pull request successfully merged' },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should successfully execute with default configuration', async () => {
    await main();

    expect(mockCore.getInput).toHaveBeenCalledWith('github-token', { required: true });
    expect(mockGithub.getOctokit).toHaveBeenCalledWith('test-token');
    expect(mockCore.setOutput).toHaveBeenCalledWith('result', 'merged');
    expect(mockCore.setOutput).toHaveBeenCalledWith('merge_method', 'squash');
    expect(mockCore.summary.addRaw).toHaveBeenCalled();
    expect(mockCore.summary.write).toHaveBeenCalled();
    expect(mockCore.info).toHaveBeenCalledWith(expect.stringContaining('lysbot-merge result: merged'));
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

    await main();

    expect(mockCore.setOutput).toHaveBeenCalledWith('result', 'merged');
  });

  it('should handle errors and call setFailed', async () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'github-token') {
        throw new Error('Token error');
      }
      return '';
    });

    await main();

    expect(mockCore.setFailed).toHaveBeenCalledWith(expect.stringContaining('Token error'));
  });

  it('should skip for non-issue_comment events', async () => {
    (mockGithub.context as { eventName: string }).eventName = 'push';

    await main();

    expect(mockCore.setOutput).toHaveBeenCalledWith('result', 'skipped');
  });

  it('should skip for non-PR comments', async () => {
    setMockContextPayload({
      issue: {
        number: 123,
      },
      comment: {
        id: 456,
        body: '/lysbot merge',
        user: { type: 'User' },
        author_association: 'MEMBER',
      },
    });

    await main();

    expect(mockCore.setOutput).toHaveBeenCalledWith('result', 'skipped');
  });

  it('should skip for bot comments', async () => {
    setMockContextPayload({
      issue: {
        number: 123,
        pull_request: {},
      },
      comment: {
        id: 456,
        body: '/lysbot merge',
        user: { type: 'Bot' },
        author_association: 'MEMBER',
      },
    });

    await main();

    expect(mockCore.setOutput).toHaveBeenCalledWith('result', 'skipped');
  });
});
