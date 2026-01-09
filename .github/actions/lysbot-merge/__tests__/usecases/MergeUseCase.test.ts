/* eslint-disable @typescript-eslint/unbound-method */
/**
 * MergeUseCase.test.ts - Comprehensive tests for MergeUseCase
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { PullRequest } from '../../src/domain/entities/PullRequest.js';
import type { IGitHubClient } from '../../src/usecases/merge/IGitHubClient.js';
import type { ILogger } from '../../src/usecases/merge/ILogger.js';
import { MergeUseCase } from '../../src/usecases/merge/MergeUseCase.js';
import type { MergeConfig, EventContext } from '../../src/usecases/merge/MergeUseCaseInput.js';

describe('MergeUseCase', () => {
  let mockGitHubClient: IGitHubClient;
  let mockLogger: ILogger;
  let useCase: MergeUseCase;
  let config: MergeConfig;

  beforeEach(() => {
    mockGitHubClient = {
      addReaction: vi.fn(),
      postComment: vi.fn(),
      getCollaboratorPermission: vi.fn(),
      fetchPullRequest: vi.fn(),
      fetchApprovedReviews: vi.fn(),
      dismissReview: vi.fn(),
      countUnresolvedThreads: vi.fn(),
      fetchPullRequestCommits: vi.fn(),
      mergePullRequest: vi.fn(),
    };

    mockLogger = {
      info: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
    };

    config = {
      releaseBranchPrefix: 'release/',
      developBranch: 'develop',
      syncBranchPrefix: 'fix/sync/',
      mergeableRetryCount: 2,
      mergeableRetryInterval: 0,
    };

    useCase = new MergeUseCase(mockGitHubClient, mockLogger, config);
  });

  const createContext = (overrides: Partial<EventContext> = {}): EventContext => ({
    prNumber: 123,
    commentId: 456,
    commentBody: '/lysbot merge',
    actor: 'testuser',
    userType: 'User',
    authorAssociation: 'OWNER',
    eventName: 'issue_comment',
    isPullRequest: true,
    ...overrides,
  });

  const createPR = (overrides: Partial<PullRequest> = {}): PullRequest => ({
    state: 'open',
    locked: false,
    draft: false,
    merged: false,
    mergeable: true,
    mergeableState: 'clean',
    headSha: 'abc123',
    headRef: 'feature/test',
    baseRef: 'develop',
    author: 'author',
    isFork: false,
    title: 'feat: test feature',
    ...overrides,
  });

  describe('Event validation', () => {
    it('should skip non-issue_comment events', async () => {
      const context = createContext({ eventName: 'pull_request' });
      const result = await useCase.execute(context, config);

      expect(result.status).toBe('skipped');
      expect(result.message).toContain('issue_comment');
    });

    it('should skip non-PR comments', async () => {
      const context = createContext({ isPullRequest: false });
      const result = await useCase.execute(context, config);

      expect(result.status).toBe('skipped');
      expect(result.message).toContain('not on a PR');
    });

    it('should skip bot comments', async () => {
      const context = createContext({ userType: 'Bot' });
      const result = await useCase.execute(context, config);

      expect(result.status).toBe('skipped');
      expect(result.message).toContain('bot');
    });

    it('should skip invalid commands', async () => {
      const context = createContext({ commentBody: 'hello world' });
      const result = await useCase.execute(context, config);

      expect(result.status).toBe('skipped');
      expect(result.message).toContain('not matched');
    });
  });

  describe('Permission validation', () => {
    it('should fail with invalid author association', async () => {
      const context = createContext({ authorAssociation: 'NONE' });
      const result = await useCase.execute(context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('association');
      expect(mockGitHubClient.postComment).toHaveBeenCalledWith(123, expect.stringContaining('Permission denied'));
    });

    it('should fail with insufficient permissions', async () => {
      const context = createContext();
      vi.mocked(mockGitHubClient.getCollaboratorPermission).mockResolvedValue('read');

      const result = await useCase.execute(context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('permissions');
      expect(mockGitHubClient.postComment).toHaveBeenCalledWith(123, expect.stringContaining('Permission denied'));
    });

    it('should add eyes reaction for valid commands', async () => {
      const context = createContext();
      vi.mocked(mockGitHubClient.getCollaboratorPermission).mockResolvedValue('write');
      vi.mocked(mockGitHubClient.fetchPullRequest).mockResolvedValue(createPR({ isFork: true }));

      await useCase.execute(context, config);

      expect(mockGitHubClient.addReaction).toHaveBeenCalledWith(456, 'eyes');
    });
  });

  describe('Fork PR handling', () => {
    it('should fail for fork PRs', async () => {
      const context = createContext();
      vi.mocked(mockGitHubClient.getCollaboratorPermission).mockResolvedValue('write');
      vi.mocked(mockGitHubClient.fetchPullRequest).mockResolvedValue(createPR({ isFork: true }));

      const result = await useCase.execute(context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('Fork');
      expect(mockGitHubClient.postComment).toHaveBeenCalledWith(123, expect.stringContaining('Fork PR not supported'));
    });
  });

  describe('Already merged handling', () => {
    it('should handle already merged PRs', async () => {
      const context = createContext();
      vi.mocked(mockGitHubClient.getCollaboratorPermission).mockResolvedValue('write');
      vi.mocked(mockGitHubClient.fetchPullRequest).mockResolvedValue(createPR({ merged: true }));

      const result = await useCase.execute(context, config);

      expect(result.status).toBe('already_merged');
      expect(mockGitHubClient.postComment).toHaveBeenCalledWith(123, expect.stringContaining('Already merged'));
    });
  });

  describe('Merge checks', () => {
    beforeEach(() => {
      vi.mocked(mockGitHubClient.getCollaboratorPermission).mockResolvedValue('write');
      vi.mocked(mockGitHubClient.countUnresolvedThreads).mockResolvedValue(0);
      vi.mocked(mockGitHubClient.fetchApprovedReviews).mockResolvedValue([
        { id: 1, state: 'APPROVED', commit_id: 'abc123', user: { login: 'reviewer' } },
      ]);
    });

    it('should fail when PR is not open', async () => {
      const context = createContext();
      vi.mocked(mockGitHubClient.fetchPullRequest).mockResolvedValue(createPR({ state: 'closed' }));

      const result = await useCase.execute(context, config);

      expect(result.status).toBe('failed');
      expect(mockGitHubClient.postComment).toHaveBeenCalledWith(123, expect.stringContaining('Merge checks failed'));
    });

    it('should fail when PR is locked', async () => {
      const context = createContext();
      vi.mocked(mockGitHubClient.fetchPullRequest).mockResolvedValue(createPR({ locked: true }));

      const result = await useCase.execute(context, config);

      expect(result.status).toBe('failed');
    });

    it('should fail when PR is draft', async () => {
      const context = createContext();
      vi.mocked(mockGitHubClient.fetchPullRequest).mockResolvedValue(createPR({ draft: true }));

      const result = await useCase.execute(context, config);

      expect(result.status).toBe('failed');
    });

    it('should fail when PR has unresolved threads', async () => {
      const context = createContext();
      vi.mocked(mockGitHubClient.fetchPullRequest).mockResolvedValue(createPR());
      vi.mocked(mockGitHubClient.countUnresolvedThreads).mockResolvedValue(2);

      const result = await useCase.execute(context, config);

      expect(result.status).toBe('failed');
    });

    it('should fail when PR has no approvals', async () => {
      const context = createContext();
      vi.mocked(mockGitHubClient.fetchPullRequest).mockResolvedValue(createPR());
      vi.mocked(mockGitHubClient.fetchApprovedReviews).mockResolvedValue([]);

      const result = await useCase.execute(context, config);

      expect(result.status).toBe('failed');
    });

    it('should pass with override approval flag when no approvals', async () => {
      const context = createContext({ commentBody: '/lysbot merge --override-approval-requirement' });
      vi.mocked(mockGitHubClient.fetchPullRequest).mockResolvedValue(createPR());
      vi.mocked(mockGitHubClient.fetchApprovedReviews).mockResolvedValue([]);
      vi.mocked(mockGitHubClient.mergePullRequest).mockResolvedValue({ success: true, mergeCommitSha: 'def456' });
      vi.mocked(mockGitHubClient.fetchPullRequestCommits).mockResolvedValue([]);

      const result = await useCase.execute(context, config);

      expect(result.status).toBe('merged');
      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('overridden'));
    });

    it('should dismiss stale approvals', async () => {
      const context = createContext();
      const pr = createPR({ headSha: 'new123' });
      vi.mocked(mockGitHubClient.fetchPullRequest).mockResolvedValue(pr);
      vi.mocked(mockGitHubClient.fetchApprovedReviews).mockResolvedValue([
        { id: 1, state: 'APPROVED', commit_id: 'old123', user: { login: 'reviewer' } },
      ]);
      vi.mocked(mockGitHubClient.dismissReview).mockResolvedValue(true);

      const result = await useCase.execute(context, config);

      expect(result.status).toBe('failed');
      expect(mockGitHubClient.dismissReview).toHaveBeenCalledWith(123, 1, expect.stringContaining('New commits'));
    });

    it('should skip self-approvals', async () => {
      const context = createContext();
      const pr = createPR({ author: 'reviewer' });
      vi.mocked(mockGitHubClient.fetchPullRequest).mockResolvedValue(pr);
      vi.mocked(mockGitHubClient.fetchApprovedReviews).mockResolvedValue([
        { id: 1, state: 'APPROVED', commit_id: 'abc123', user: { login: 'reviewer' } },
      ]);

      const result = await useCase.execute(context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('Merge checks failed');
    });

    it('should fail when merge conflicts exist', async () => {
      const context = createContext();
      vi.mocked(mockGitHubClient.fetchPullRequest).mockResolvedValue(createPR({ mergeableState: 'dirty' }));

      const result = await useCase.execute(context, config);

      expect(result.status).toBe('failed');
    });
  });

  describe('Successful merge', () => {
    beforeEach(() => {
      vi.mocked(mockGitHubClient.getCollaboratorPermission).mockResolvedValue('write');
      vi.mocked(mockGitHubClient.countUnresolvedThreads).mockResolvedValue(0);
      vi.mocked(mockGitHubClient.fetchApprovedReviews).mockResolvedValue([
        { id: 1, state: 'APPROVED', commit_id: 'abc123', user: { login: 'reviewer' } },
      ]);
      vi.mocked(mockGitHubClient.fetchPullRequestCommits).mockResolvedValue([
        { commit: { message: 'feat: add feature', author: { name: 'Test', email: 'test@example.com' } } },
      ]);
    });

    it('should successfully merge with squash method for develop base', async () => {
      const context = createContext();
      const pr = createPR({ baseRef: 'develop' });
      vi.mocked(mockGitHubClient.fetchPullRequest).mockResolvedValue(pr);
      vi.mocked(mockGitHubClient.mergePullRequest).mockResolvedValue({ success: true, mergeCommitSha: 'def456' });

      const result = await useCase.execute(context, config);

      expect(result.status).toBe('merged');
      expect(result.mergeMethod).toBe('squash');
      expect(mockGitHubClient.mergePullRequest).toHaveBeenCalledWith(
        123,
        'squash',
        'abc123',
        expect.any(String),
        expect.any(String),
      );
    });

    it('should successfully merge with merge method for release branch', async () => {
      const context = createContext();
      const pr = createPR({ headRef: 'release/v1.0.0' });
      vi.mocked(mockGitHubClient.fetchPullRequest).mockResolvedValue(pr);
      vi.mocked(mockGitHubClient.mergePullRequest).mockResolvedValue({ success: true });

      const result = await useCase.execute(context, config);

      expect(result.status).toBe('merged');
      expect(result.mergeMethod).toBe('merge');
    });

    it('should handle merge failure', async () => {
      const context = createContext();
      vi.mocked(mockGitHubClient.fetchPullRequest).mockResolvedValue(createPR());
      vi.mocked(mockGitHubClient.mergePullRequest).mockResolvedValue({ success: false, error: 'Merge conflict' });

      const result = await useCase.execute(context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('Merge failed');
    });
  });

  describe('TOCTOU protection', () => {
    beforeEach(() => {
      vi.mocked(mockGitHubClient.getCollaboratorPermission).mockResolvedValue('write');
      vi.mocked(mockGitHubClient.countUnresolvedThreads).mockResolvedValue(0);
      vi.mocked(mockGitHubClient.fetchApprovedReviews).mockResolvedValue([
        { id: 1, state: 'APPROVED', commit_id: 'abc123', user: { login: 'reviewer' } },
      ]);
    });

    it('should detect new commits before merge', async () => {
      const context = createContext();
      const pr1 = createPR({ headSha: 'abc123' });
      const pr2 = createPR({ headSha: 'xyz789' });

      vi.mocked(mockGitHubClient.fetchPullRequest).mockResolvedValueOnce(pr1).mockResolvedValueOnce(pr2);

      const result = await useCase.execute(context, config);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('TOCTOU');
      expect(mockGitHubClient.postComment).toHaveBeenCalledWith(123, expect.stringContaining('New commits detected'));
    });
  });

  describe('Mergeability waiting', () => {
    beforeEach(() => {
      vi.mocked(mockGitHubClient.getCollaboratorPermission).mockResolvedValue('write');
      vi.mocked(mockGitHubClient.countUnresolvedThreads).mockResolvedValue(0);
      vi.mocked(mockGitHubClient.fetchApprovedReviews).mockResolvedValue([
        { id: 1, state: 'APPROVED', commit_id: 'abc123', user: { login: 'reviewer' } },
      ]);
      vi.mocked(mockGitHubClient.fetchPullRequestCommits).mockResolvedValue([]);
    });

    it('should wait for mergeable status and succeed', async () => {
      const context = createContext();
      const pr1 = createPR({ mergeable: null });
      const pr2 = createPR({ mergeable: true });

      vi.mocked(mockGitHubClient.fetchPullRequest)
        .mockResolvedValueOnce(pr1)
        .mockResolvedValueOnce(pr1)
        .mockResolvedValueOnce(pr2);
      vi.mocked(mockGitHubClient.mergePullRequest).mockResolvedValue({ success: true });

      const result = await useCase.execute(context, config);

      expect(result.status).toBe('merged');
    });

    it('should fail when mergeable stays null', async () => {
      const context = createContext();
      const pr = createPR({ mergeable: null });

      vi.mocked(mockGitHubClient.fetchPullRequest).mockResolvedValue(pr);

      const result = await useCase.execute(context, config);

      expect(result.status).toBe('failed');
      expect(mockGitHubClient.postComment).toHaveBeenCalledWith(
        123,
        expect.stringContaining('Mergeability status pending'),
      );
    });

    it('should fail when mergeable is false', async () => {
      const context = createContext();
      const pr1 = createPR({ mergeable: true });
      const pr2 = createPR({ mergeable: false, mergeableState: 'dirty' });

      vi.mocked(mockGitHubClient.fetchPullRequest).mockResolvedValueOnce(pr1).mockResolvedValueOnce(pr2);

      const result = await useCase.execute(context, config);

      expect(result.status).toBe('failed');
      expect(mockGitHubClient.postComment).toHaveBeenCalledWith(123, expect.stringContaining('Conflicts detected'));
    });
  });

  describe('Commit message building', () => {
    beforeEach(() => {
      vi.mocked(mockGitHubClient.getCollaboratorPermission).mockResolvedValue('write');
      vi.mocked(mockGitHubClient.countUnresolvedThreads).mockResolvedValue(0);
      vi.mocked(mockGitHubClient.fetchApprovedReviews).mockResolvedValue([
        { id: 1, state: 'APPROVED', commit_id: 'abc123', user: { login: 'reviewer' } },
      ]);
      vi.mocked(mockGitHubClient.mergePullRequest).mockResolvedValue({ success: true });
    });

    it('should build merge commit message correctly', async () => {
      const context = createContext();
      const pr = createPR({ headRef: 'release/v1.0.0', title: 'Release v1.0.0' });
      vi.mocked(mockGitHubClient.fetchPullRequest).mockResolvedValue(pr);
      vi.mocked(mockGitHubClient.fetchPullRequestCommits).mockResolvedValue([]);

      await useCase.execute(context, config);

      expect(mockGitHubClient.mergePullRequest).toHaveBeenCalledWith(
        123,
        'merge',
        'abc123',
        'Merge pull request #123 from release/v1.0.0',
        expect.stringContaining('Release v1.0.0'),
      );
    });

    it('should build squash commit message with commits and co-authors', async () => {
      const context = createContext();
      vi.mocked(mockGitHubClient.fetchPullRequest).mockResolvedValue(createPR());
      vi.mocked(mockGitHubClient.fetchPullRequestCommits).mockResolvedValue([
        { commit: { message: 'feat: add feature\n\nDetails', author: { name: 'Alice', email: 'alice@example.com' } } },
        { commit: { message: 'fix: bug fix', author: { name: 'Bob', email: 'bob@example.com' } } },
      ]);

      await useCase.execute(context, config);

      const call = vi.mocked(mockGitHubClient.mergePullRequest).mock.calls[0];
      const commitBody = call?.[4];
      expect(commitBody).toContain('* feat: add feature');
      expect(commitBody).toContain('* fix: bug fix');
      expect(commitBody).toContain('Co-authored-by: Alice <alice@example.com>');
      expect(commitBody).toContain('Co-authored-by: Bob <bob@example.com>');
    });

    it('should include override marker when approval overridden', async () => {
      const context = createContext({ commentBody: '/lysbot merge --override-approval-requirement' });
      vi.mocked(mockGitHubClient.fetchPullRequest).mockResolvedValue(createPR());
      vi.mocked(mockGitHubClient.fetchApprovedReviews).mockResolvedValue([]);
      vi.mocked(mockGitHubClient.fetchPullRequestCommits).mockResolvedValue([]);

      await useCase.execute(context, config);

      const call = vi.mocked(mockGitHubClient.mergePullRequest).mock.calls[0];
      const commitBody = call?.[4];
      expect(commitBody).toContain('EXCEPTIONAL MERGE');
      expect(commitBody).toContain('override-approval-requirement');
    });
  });
});
