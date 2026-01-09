/**
 * app.test.ts - Unit tests for application layer
 *
 * Tests the MergeAppService using fake implementations (test doubles).
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { MergeAppService, type EventContext } from '../../../src/modules/merge/app.js';
import type { ActionConfig } from '../../../src/modules/merge/domain.js';
import { FakeGitHubRepository, FakeLogger, FakeTimeProvider } from '../../doubles/index.js';

// =============================================================================
// Test Utilities
// =============================================================================

function createEventContext(overrides: Partial<EventContext> = {}): EventContext {
  return {
    owner: 'test-owner',
    repo: 'test-repo',
    prNumber: 1,
    commentId: 100,
    commentBody: '/lysbot merge',
    actor: 'test-user',
    userType: 'User',
    authorAssociation: 'MEMBER',
    serverUrl: 'https://github.com',
    runId: 12345,
    eventName: 'issue_comment',
    isPullRequest: true,
    ...overrides,
  };
}

function createConfig(overrides: Partial<ActionConfig> = {}): ActionConfig {
  return {
    releaseBranchPrefix: 'release/',
    developBranch: 'develop',
    syncBranchPrefix: 'fix/sync/',
    mergeableRetryCount: 5,
    mergeableRetryInterval: 10,
    ...overrides,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('MergeAppService', () => {
  let githubRepo: FakeGitHubRepository;
  let logger: FakeLogger;
  let timeProvider: FakeTimeProvider;
  let appService: MergeAppService;

  beforeEach(() => {
    githubRepo = new FakeGitHubRepository();
    logger = new FakeLogger();
    timeProvider = new FakeTimeProvider();
    appService = new MergeAppService({ githubRepo, logger, timeProvider });
  });

  describe('Event validation', () => {
    it('should skip when event is not issue_comment', async () => {
      const context = createEventContext({ eventName: 'pull_request' });
      const config = createConfig();
      const mergeOptions = { overrideApprovalRequirement: false };

      const result = await appService.execute({ context, config, mergeOptions });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('skipped');
        expect(result.value.message).toBe('This action only runs on issue_comment events');
      }
    });

    it('should skip when comment is not on a PR', async () => {
      const context = createEventContext({ isPullRequest: false });
      const config = createConfig();
      const mergeOptions = { overrideApprovalRequirement: false };

      const result = await appService.execute({ context, config, mergeOptions });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('skipped');
        expect(result.value.message).toBe('Comment is not on a PR, skipping');
      }
    });

    it('should skip when comment is from a bot', async () => {
      const context = createEventContext({ userType: 'Bot' });
      const config = createConfig();
      const mergeOptions = { overrideApprovalRequirement: false };

      const result = await appService.execute({ context, config, mergeOptions });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('skipped');
        expect(result.value.message).toBe('Comment is from a bot');
      }
    });

    it('should skip when command does not match', async () => {
      const context = createEventContext({ commentBody: 'hello world' });
      const config = createConfig();
      const mergeOptions = { overrideApprovalRequirement: false };

      const result = await appService.execute({ context, config, mergeOptions });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('skipped');
        expect(result.value.message).toBe('Command not matched');
      }
    });
  });

  describe('Permission validation', () => {
    it('should fail when author association is invalid', async () => {
      const context = createEventContext({ authorAssociation: 'CONTRIBUTOR' });
      const config = createConfig();
      const mergeOptions = { overrideApprovalRequirement: false };

      const result = await appService.execute({ context, config, mergeOptions });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('failed');
        expect(result.value.message).toBe('Invalid author association');
        expect(githubRepo.comments.length).toBeGreaterThan(0);
        expect(githubRepo.comments[0]!.body).toContain('Permission denied');
      }
    });

    it('should fail when permission level is insufficient', async () => {
      const context = createEventContext({ authorAssociation: 'MEMBER', actor: 'test-user' });
      const config = createConfig();
      const mergeOptions = { overrideApprovalRequirement: false };

      // Set up fake repository with read permission
      githubRepo.setPermission('test-user', 'read');

      const result = await appService.execute({ context, config, mergeOptions });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('failed');
        expect(result.value.message).toBe('Insufficient permissions');
      }
    });
  });

  describe('PR validation', () => {
    it('should fail when PR is from a fork', async () => {
      const context = createEventContext();
      const config = createConfig();
      const mergeOptions = { overrideApprovalRequirement: false };

      // Set up fake repository
      githubRepo.setPermission('test-user', 'write');
      githubRepo.setPullRequest(1, {
        state: 'open',
        locked: false,
        draft: false,
        merged: false,
        mergeable: true,
        mergeableState: 'clean',
        headSha: 'abc123',
        headRef: 'feature-branch',
        baseRef: 'main',
        author: 'author-user',
        isFork: true,
        title: 'Test PR',
      });

      const result = await appService.execute({ context, config, mergeOptions });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('failed');
        expect(result.value.message).toBe('Fork PR not supported');
      }
    });

    it('should return already_merged when PR is already merged', async () => {
      const context = createEventContext();
      const config = createConfig();
      const mergeOptions = { overrideApprovalRequirement: false };

      // Set up fake repository
      githubRepo.setPermission('test-user', 'write');
      githubRepo.setPullRequest(1, {
        state: 'closed',
        locked: false,
        draft: false,
        merged: true,
        mergeable: false,
        mergeableState: 'unknown',
        headSha: 'abc123',
        headRef: 'feature-branch',
        baseRef: 'main',
        author: 'author-user',
        isFork: false,
        title: 'Test PR',
      });

      const result = await appService.execute({ context, config, mergeOptions });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('already_merged');
        expect(result.value.message).toBe('PR already merged');
      }
    });
  });

  describe('Successful merge', () => {
    it('should merge successfully when all checks pass', async () => {
      const context = createEventContext();
      const config = createConfig();
      const mergeOptions = { overrideApprovalRequirement: false };

      // Set up fake repository with passing checks
      githubRepo.setPermission('test-user', 'write');
      githubRepo.setPullRequest(1, {
        state: 'open',
        locked: false,
        draft: false,
        merged: false,
        mergeable: true,
        mergeableState: 'clean',
        headSha: 'abc123',
        headRef: 'feature-branch',
        baseRef: 'develop',
        author: 'author-user',
        isFork: false,
        title: 'feat: add new feature',
      });
      githubRepo.setReviews(1, [
        {
          id: 1,
          state: 'APPROVED',
          commit_id: 'abc123',
          user: { login: 'reviewer-user' },
        },
      ]);
      githubRepo.setUnresolvedThreadCount(1, 0);
      githubRepo.setCommits(1, [
        {
          commit: {
            message: 'Add feature',
            author: { name: 'Author', email: 'author@example.com' },
          },
        },
      ]);
      githubRepo.setMergeResult(1, { success: true, mergeCommitSha: 'merge123' });

      const result = await appService.execute({ context, config, mergeOptions });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('merged');
        expect(result.value.message).toBe('PR merged successfully');
        expect(result.value.mergeMethod).toBe('squash');
      }

      // Verify eyes reaction was added
      expect(githubRepo.reactions.length).toBeGreaterThan(0);
      expect(githubRepo.reactions[0]!.reaction).toBe('eyes');

      // Verify success comment was posted
      const successComment = githubRepo.comments.find((c) => c.body.includes('Merged by lysbot-merge'));
      expect(successComment).toBeDefined();
    });

    it('should use merge method for release branches', async () => {
      const context = createEventContext();
      const config = createConfig();
      const mergeOptions = { overrideApprovalRequirement: false };

      // Set up fake repository with release branch
      githubRepo.setPermission('test-user', 'write');
      githubRepo.setPullRequest(1, {
        state: 'open',
        locked: false,
        draft: false,
        merged: false,
        mergeable: true,
        mergeableState: 'clean',
        headSha: 'abc123',
        headRef: 'release/v1.0.0',
        baseRef: 'main',
        author: 'author-user',
        isFork: false,
        title: 'Release v1.0.0',
      });
      githubRepo.setReviews(1, [
        {
          id: 1,
          state: 'APPROVED',
          commit_id: 'abc123',
          user: { login: 'reviewer-user' },
        },
      ]);
      githubRepo.setUnresolvedThreadCount(1, 0);
      githubRepo.setCommits(1, []);
      githubRepo.setMergeResult(1, { success: true, mergeCommitSha: 'merge123' });

      const result = await appService.execute({ context, config, mergeOptions });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('merged');
        expect(result.value.mergeMethod).toBe('merge');
      }
    });
  });

  describe('Approval override', () => {
    it('should merge with override when no approvals exist', async () => {
      const context = createEventContext({ commentBody: '/lysbot merge --override-approval-requirement' });
      const config = createConfig();
      const mergeOptions = { overrideApprovalRequirement: true };

      // Set up fake repository with no approvals
      githubRepo.setPermission('test-user', 'write');
      githubRepo.setPullRequest(1, {
        state: 'open',
        locked: false,
        draft: false,
        merged: false,
        mergeable: true,
        mergeableState: 'clean',
        headSha: 'abc123',
        headRef: 'feature-branch',
        baseRef: 'develop',
        author: 'author-user',
        isFork: false,
        title: 'feat: add feature',
      });
      githubRepo.setReviews(1, []); // No reviews
      githubRepo.setUnresolvedThreadCount(1, 0);
      githubRepo.setCommits(1, []);
      githubRepo.setMergeResult(1, { success: true });

      const result = await appService.execute({ context, config, mergeOptions });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe('merged');
        expect(result.value.message).toBe('PR merged successfully');
      }

      // Verify logger was called with override message
      expect(logger.hasInfo('Approval requirement overridden by command flag (--override-approval-requirement).')).toBe(
        true,
      );
    });
  });
});
