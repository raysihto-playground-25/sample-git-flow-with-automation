/**
 * usecase.test.ts - Tests for MergePullRequestUseCase
 *
 * Tests cover the main use case orchestration logic for merge operations.
 * This replaces the old action.test.ts with tests adapted to the new Clean Architecture structure.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

import type { PullRequest } from '../src/domain/entities/PullRequest.js';
import type { MergePullRequestInput } from '../src/usecases/merge/MergePullRequestDTO.js';
import { MergePullRequestUseCase } from '../src/usecases/merge/MergePullRequestUseCase.js';
import type { GitHubClient, Review } from '../src/usecases/ports/GitHubClient.js';
import type { Logger } from '../src/usecases/ports/Logger.js';

// =============================================================================
// Test Utilities & Mocks
// =============================================================================

/**
 * Creates a mock GitHubClient for tests
 */
function createMockGitHubClient(): GitHubClient & {
  addReaction: Mock;
  postComment: Mock;
  getCollaboratorPermission: Mock;
  fetchPullRequest: Mock;
  fetchApprovedReviews: Mock;
  dismissReview: Mock;
  countUnresolvedThreads: Mock;
  fetchPullRequestCommits: Mock;
  mergePullRequest: Mock;
} {
  return {
    addReaction: vi.fn().mockResolvedValue(undefined),
    postComment: vi.fn().mockResolvedValue(undefined),
    getCollaboratorPermission: vi.fn().mockResolvedValue('write'),
    fetchPullRequest: vi.fn().mockResolvedValue({
      state: 'open',
      locked: false,
      draft: false,
      merged: false,
      mergeable: true,
      mergeableState: 'clean',
      headSha: 'abc1234567890',
      headRef: 'feature/test',
      baseRef: 'develop',
      author: 'testuser',
      isFork: false,
      title: 'feat: test pull request',
    } as PullRequest),
    fetchApprovedReviews: vi.fn().mockResolvedValue([]),
    dismissReview: vi.fn().mockResolvedValue(true),
    countUnresolvedThreads: vi.fn().mockResolvedValue(0),
    fetchPullRequestCommits: vi.fn().mockResolvedValue([]),
    mergePullRequest: vi.fn().mockResolvedValue({
      success: true,
      mergeCommitSha: 'merge123456789',
    }),
  };
}

/**
 * Creates a mock Logger for tests
 */
function createMockLogger(): Logger {
  return {
    info: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  };
}

/**
 * Creates a default input for tests
 */
function createInput(overrides: Partial<MergePullRequestInput> = {}): MergePullRequestInput {
  return {
    owner: 'testowner',
    repo: 'testrepo',
    prNumber: 1,
    commentId: 123,
    commentBody: '/lysbot merge',
    actor: 'testactor',
    userType: 'User',
    authorAssociation: 'MEMBER',
    eventName: 'issue_comment',
    isPullRequest: true,
    mergeConfig: {
      releaseBranchPrefix: 'release/',
      developBranch: 'develop',
      syncBranchPrefix: 'fix/sync/',
    },
    retryConfig: {
      mergeableRetryCount: 5,
      mergeableRetryInterval: 10,
    },
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('MergePullRequestUseCase', () => {
  let githubClient: ReturnType<typeof createMockGitHubClient>;
  let logger: Logger;
  let useCase: MergePullRequestUseCase;

  beforeEach(() => {
    githubClient = createMockGitHubClient();
    logger = createMockLogger();
    useCase = new MergePullRequestUseCase(githubClient, logger);
  });

  describe('event type validation', () => {
    it('should skip processing for non-issue_comment events', async () => {
      const input = createInput({ eventName: 'push' });

      const result = await useCase.execute(input);

      expect(result.status).toBe('skipped');
      expect(result.message).toContain('issue_comment');
    });

    it('should skip processing for issue comments (not PR comments)', async () => {
      const input = createInput({ isPullRequest: false });

      const result = await useCase.execute(input);

      expect(result.status).toBe('skipped');
      expect(result.message).toContain('not on a PR');
    });
  });

  describe('command and user validation', () => {
    it('should skip processing for bot comments', async () => {
      const input = createInput({ userType: 'Bot' });

      const result = await useCase.execute(input);

      expect(result.status).toBe('skipped');
      expect(result.message).toContain('bot');
    });

    it('should skip processing for invalid commands', async () => {
      const input = createInput({ commentBody: 'hello world' });

      const result = await useCase.execute(input);

      expect(result.status).toBe('skipped');
      expect(result.message).toContain('Command not matched');
    });

    it('should add eyes reaction for valid merge command', async () => {
      const input = createInput();

      await useCase.execute(input);

      expect(githubClient.addReaction).toHaveBeenCalledWith('testowner', 'testrepo', 123, 'eyes');
    });
  });

  describe('permission validation', () => {
    it('should fail for invalid author association', async () => {
      const input = createInput({ authorAssociation: 'NONE' });

      const result = await useCase.execute(input);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('Invalid author association');
      expect(githubClient.postComment).toHaveBeenCalledWith(
        'testowner',
        'testrepo',
        1,
        expect.stringContaining('Permission denied'),
      );
    });

    it('should fail for insufficient permissions', async () => {
      githubClient.getCollaboratorPermission.mockResolvedValue('read');
      const input = createInput();

      const result = await useCase.execute(input);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('Insufficient permissions');
    });
  });

  describe('PR state validation', () => {
    it('should fail for fork PRs', async () => {
      githubClient.fetchPullRequest.mockResolvedValue({
        state: 'open',
        locked: false,
        draft: false,
        merged: false,
        mergeable: true,
        mergeableState: 'clean',
        headSha: 'abc',
        headRef: 'feature/test',
        baseRef: 'develop',
        author: 'testuser',
        isFork: true,
        title: 'feat: test',
      });
      const input = createInput();

      const result = await useCase.execute(input);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('Fork PR not supported');
    });

    it('should skip for already merged PRs', async () => {
      githubClient.fetchPullRequest.mockResolvedValue({
        state: 'closed',
        locked: false,
        draft: false,
        merged: true,
        mergeable: null,
        mergeableState: 'clean',
        headSha: 'abc',
        headRef: 'feature/test',
        baseRef: 'develop',
        author: 'testuser',
        isFork: false,
        title: 'feat: test',
      });
      const input = createInput();

      const result = await useCase.execute(input);

      expect(result.status).toBe('already_merged');
      expect(result.message).toContain('already merged');
    });
  });

  describe('merge checks', () => {
    it('should fail when PR is closed', async () => {
      githubClient.fetchPullRequest.mockResolvedValue({
        state: 'closed',
        locked: false,
        draft: false,
        merged: false,
        mergeable: true,
        mergeableState: 'clean',
        headSha: 'abc',
        headRef: 'feature/test',
        baseRef: 'develop',
        author: 'testuser',
        isFork: false,
        title: 'feat: test',
      });
      const input = createInput();

      const result = await useCase.execute(input);

      expect(result.status).toBe('failed');
      expect(githubClient.postComment).toHaveBeenCalledWith(
        'testowner',
        'testrepo',
        1,
        expect.stringContaining('Merge checks failed'),
      );
    });

    it('should fail when there are unresolved threads', async () => {
      githubClient.countUnresolvedThreads.mockResolvedValue(2);
      const input = createInput();

      const result = await useCase.execute(input);

      expect(result.status).toBe('failed');
    });

    it('should fail without approvals', async () => {
      const input = createInput();

      const result = await useCase.execute(input);

      expect(result.status).toBe('failed');
      expect(githubClient.postComment).toHaveBeenCalledWith(
        'testowner',
        'testrepo',
        1,
        expect.stringContaining('no valid approvals'),
      );
    });

    it('should pass with valid approval', async () => {
      const mockReviews: Review[] = [
        {
          id: 1,
          user: { login: 'reviewer' },
          state: 'APPROVED',
          commit_id: 'abc1234567890',
        },
      ];
      githubClient.fetchApprovedReviews.mockResolvedValue(mockReviews);
      const input = createInput();

      const result = await useCase.execute(input);

      expect(result.status).toBe('merged');
    });

    it('should dismiss stale reviews', async () => {
      const mockReviews: Review[] = [
        {
          id: 1,
          user: { login: 'reviewer' },
          state: 'APPROVED',
          commit_id: 'oldcommit',
        },
      ];
      githubClient.fetchApprovedReviews.mockResolvedValue(mockReviews);
      const input = createInput();

      await useCase.execute(input);

      expect(githubClient.dismissReview).toHaveBeenCalledWith(
        'testowner',
        'testrepo',
        1,
        1,
        expect.stringContaining('Approval dismissed'),
      );
    });
  });

  describe('approval requirement override', () => {
    it('should allow merge with --override-approval-requirement flag', async () => {
      const input = createInput({ commentBody: '/lysbot merge --override-approval-requirement' });

      const result = await useCase.execute(input);

      expect(result.status).toBe('merged');
      // Verify override was applied - merge succeeded without approvals
      expect(githubClient.fetchApprovedReviews).toHaveBeenCalled();
    });
  });

  describe('successful merge', () => {
    beforeEach(() => {
      const mockReviews: Review[] = [
        {
          id: 1,
          user: { login: 'reviewer' },
          state: 'APPROVED',
          commit_id: 'abc1234567890',
        },
      ];
      githubClient.fetchApprovedReviews.mockResolvedValue(mockReviews);
    });

    it('should merge successfully with squash method for feature to develop', async () => {
      const input = createInput();

      const result = await useCase.execute(input);

      expect(result.status).toBe('merged');
      expect(result.mergeMethod).toBe('squash');
      expect(githubClient.mergePullRequest).toHaveBeenCalledWith(
        'testowner',
        'testrepo',
        1,
        'squash',
        'abc1234567890',
        expect.any(String),
        expect.any(String),
      );
    });

    it('should merge successfully with merge method for release branches', async () => {
      githubClient.fetchPullRequest.mockResolvedValue({
        state: 'open',
        locked: false,
        draft: false,
        merged: false,
        mergeable: true,
        mergeableState: 'clean',
        headSha: 'abc1234567890',
        headRef: 'release/1.0.0',
        baseRef: 'main',
        author: 'testuser',
        isFork: false,
        title: 'feat: release 1.0.0',
      });
      const input = createInput();

      const result = await useCase.execute(input);

      expect(result.status).toBe('merged');
      expect(result.mergeMethod).toBe('merge');
    });

    it('should post success comment after merge', async () => {
      const input = createInput();

      await useCase.execute(input);

      expect(githubClient.postComment).toHaveBeenCalledWith(
        'testowner',
        'testrepo',
        1,
        expect.stringContaining('Merged by lysbot-merge'),
      );
    });
  });

  describe('TOCTOU checks', () => {
    beforeEach(() => {
      const mockReviews: Review[] = [
        {
          id: 1,
          user: { login: 'reviewer' },
          state: 'APPROVED',
          commit_id: 'abc1234567890',
        },
      ];
      githubClient.fetchApprovedReviews.mockResolvedValue(mockReviews);
    });

    it('should fail if HEAD SHA changes during validation', async () => {
      let callCount = 0;
      const mockFetchPR = (): Promise<PullRequest> => {
        callCount++;
        return Promise.resolve({
          state: 'open',
          locked: false,
          draft: false,
          merged: false,
          mergeable: true,
          mergeableState: 'clean',
          headSha: callCount === 1 ? 'abc1234567890' : 'newsha',
          headRef: 'feature/test',
          baseRef: 'develop',
          author: 'testuser',
          isFork: false,
          title: 'feat: test',
        });
      };
      githubClient.fetchPullRequest.mockImplementation(mockFetchPR);
      const input = createInput();

      const result = await useCase.execute(input);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('TOCTOU');
    });
  });

  describe('merge failures', () => {
    beforeEach(() => {
      const mockReviews: Review[] = [
        {
          id: 1,
          user: { login: 'reviewer' },
          state: 'APPROVED',
          commit_id: 'abc1234567890',
        },
      ];
      githubClient.fetchApprovedReviews.mockResolvedValue(mockReviews);
    });

    it('should handle merge API failures', async () => {
      githubClient.mergePullRequest.mockResolvedValue({
        success: false,
        error: 'Merge conflict',
      });
      const input = createInput();

      const result = await useCase.execute(input);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('Merge failed');
    });

    it('should handle not mergeable state after checks pass', async () => {
      githubClient.fetchPullRequest
        .mockResolvedValueOnce({
          state: 'open',
          locked: false,
          draft: false,
          merged: false,
          mergeable: true,
          mergeableState: 'clean',
          headSha: 'abc1234567890',
          headRef: 'feature/test',
          baseRef: 'develop',
          author: 'testuser',
          isFork: false,
          title: 'feat: test',
        })
        .mockResolvedValueOnce({
          state: 'open',
          locked: false,
          draft: false,
          merged: false,
          mergeable: false,
          mergeableState: 'dirty',
          headSha: 'abc1234567890',
          headRef: 'feature/test',
          baseRef: 'develop',
          author: 'testuser',
          isFork: false,
          title: 'feat: test',
        });
      const input = createInput();

      const result = await useCase.execute(input);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('Not mergeable');
    });
  });
});
