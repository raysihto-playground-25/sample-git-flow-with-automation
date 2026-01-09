/**
 * action.test.ts - Unit tests for action layer
 *
 * Tests the action layer which handles input/output mapping.
 */

import { describe, it, expect, beforeEach } from 'vitest';

import { runMergeAction, buildSummaryMarkdown } from '../../../src/modules/merge/action.js';
import type { EventContext } from '../../../src/modules/merge/app.js';
import { FakeActionsCore, FakeGitHubRepository, FakeLogger, FakeTimeProvider } from '../../doubles/index.js';

describe('Action Layer', () => {
  let core: FakeActionsCore;
  let githubRepo: FakeGitHubRepository;
  let logger: FakeLogger;
  let timeProvider: FakeTimeProvider;

  beforeEach(() => {
    core = new FakeActionsCore();
    githubRepo = new FakeGitHubRepository();
    logger = new FakeLogger();
    timeProvider = new FakeTimeProvider();

    // Set default inputs
    core.setInput('github-token', 'test-token');
    core.setInput('release_branch_prefix', 'release/');
    core.setInput('develop_branch', 'develop');
    core.setInput('sync_branch_prefix', 'fix/sync/');
    core.setInput('mergeable_retry_count', '5');
    core.setInput('mergeable_retry_interval', '10');
  });

  describe('runMergeAction', () => {
    it('should skip when comment body is not a valid command', async () => {
      const context: EventContext = {
        owner: 'test-owner',
        repo: 'test-repo',
        prNumber: 1,
        commentId: 100,
        commentBody: 'hello world',
        actor: 'test-user',
        userType: 'User',
        authorAssociation: 'MEMBER',
        serverUrl: 'https://github.com',
        runId: 12345,
        eventName: 'issue_comment',
        isPullRequest: true,
      };

      const deps = { githubRepo, logger, timeProvider };

      const result = await runMergeAction(core, context, deps);

      expect(result.status).toBe('skipped');
      expect(result.message).toBe('Command not matched');
    });

    it('should execute when comment is a valid merge command', async () => {
      const context: EventContext = {
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
      };

      // Set up permissions
      githubRepo.setPermission('test-user', 'write');
      githubRepo.setPullRequest(1, {
        state: 'open',
        locked: false,
        draft: false,
        merged: false,
        mergeable: true,
        mergeableState: 'clean',
        headSha: 'abc123',
        headRef: 'feature',
        baseRef: 'develop',
        author: 'author-user',
        isFork: false,
        title: 'feat: test',
      });
      githubRepo.setReviews(1, [
        {
          id: 1,
          state: 'APPROVED',
          commit_id: 'abc123',
          user: { login: 'reviewer' },
        },
      ]);
      githubRepo.setUnresolvedThreadCount(1, 0);
      githubRepo.setCommits(1, []);
      githubRepo.setMergeResult(1, { success: true });

      const deps = { githubRepo, logger, timeProvider };

      const result = await runMergeAction(core, context, deps);

      expect(result.status).toBe('merged');
      expect(result.message).toBe('PR merged successfully');
    });

    it('should handle errors gracefully', async () => {
      const context: EventContext = {
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
      };

      // Set up permission but not PR data - this should cause an error
      githubRepo.setPermission('test-user', 'write');
      const deps = { githubRepo, logger, timeProvider };

      const result = await runMergeAction(core, context, deps);

      expect(result.status).toBe('failed');
      expect(result.message).toContain('Internal error');
    });
  });

  describe('buildSummaryMarkdown', () => {
    it('should build summary without merge method', () => {
      const markdown = buildSummaryMarkdown('✅ Success', 123, 'test-user');

      expect(markdown).toContain('lysbot-merge Summary');
      expect(markdown).toContain('#123');
      expect(markdown).toContain('@test-user');
      expect(markdown).not.toContain('Merge Method');
    });

    it('should build summary with merge method', () => {
      const markdown = buildSummaryMarkdown('✅ Success', 123, 'test-user', 'squash');

      expect(markdown).toContain('lysbot-merge Summary');
      expect(markdown).toContain('#123');
      expect(markdown).toContain('@test-user');
      expect(markdown).toContain('squash');
    });
  });
});
