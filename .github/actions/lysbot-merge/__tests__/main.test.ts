import { beforeEach, describe, expect, it } from 'vitest';

import { configureMergeModule } from '../src/modules/merge/index.js';

import { createMockOctokit } from './helpers/fixtures.js';
import { TestCoreAdapter, TestGitHubAdapter } from './helpers/test-adapters.js';

describe('main', () => {
  let coreAdapter: TestCoreAdapter;
  let githubAdapter: TestGitHubAdapter;

  beforeEach(() => {
    coreAdapter = new TestCoreAdapter();
    githubAdapter = new TestGitHubAdapter();

    // Setup default inputs
    coreAdapter.setInput('github-token', 'test-token');

    // Create mock octokit
    const octokit = createMockOctokit();
    githubAdapter.setOctokit(octokit);
  });

  describe('DI integration', () => {
    it('should configure merge module with real dependencies', () => {
      const mergeModule = configureMergeModule(coreAdapter, githubAdapter);

      expect(mergeModule).toBeDefined();
      expect(mergeModule.mergeService).toBeDefined();
      expect(mergeModule.actionRunner).toBeDefined();
    });

    it('should execute action through configured module', async () => {
      const mergeModule = configureMergeModule(coreAdapter, githubAdapter);

      await mergeModule.actionRunner.run();

      // Should have set outputs (testing end-to-end integration)
      expect(coreAdapter.getOutput('result')).toBeDefined();
    });
  });
});
