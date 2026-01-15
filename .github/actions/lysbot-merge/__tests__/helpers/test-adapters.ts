/**
 * Test adapters - implementations of adapter interfaces for testing
 * These allow testing without vi.mock by using real DI
 */

import type { CoreAdapter, GitHubAdapter, GitHubContext } from '../../src/modules/merge/internal/adapters.js';

export class TestCoreAdapter implements CoreAdapter {
  private inputs = new Map<string, string>();
  private outputs = new Map<string, string>();
  private failures: string[] = [];
  private infoMessages: string[] = [];
  private summaryText = '';

  setInput(name: string, value: string): void {
    this.inputs.set(name, value);
  }

  getInput(name: string, options?: { required?: boolean }): string {
    const value = this.inputs.get(name) || '';
    if (options?.required && !value) {
      throw new Error(`Input required and not supplied: ${name}`);
    }
    return value;
  }

  setOutput(name: string, value: string): void {
    this.outputs.set(name, value);
  }

  getOutput(name: string): string | undefined {
    return this.outputs.get(name);
  }

  setFailed(message: string): void {
    this.failures.push(message);
  }

  getFailures(): string[] {
    return [...this.failures];
  }

  info(message: string): void {
    this.infoMessages.push(message);
  }

  getInfoMessages(): string[] {
    return [...this.infoMessages];
  }

  get summary() {
    return {
      addRaw: (text: string) => {
        this.summaryText = text;
        return {
          write: async () => {
            // No-op for tests
          },
        };
      },
    };
  }

  getSummaryText(): string {
    return this.summaryText;
  }

  reset(): void {
    this.inputs.clear();
    this.outputs.clear();
    this.failures = [];
    this.infoMessages = [];
    this.summaryText = '';
  }
}

export class TestGitHubAdapter implements GitHubAdapter {
  public context: GitHubContext;
  private octokitInstance: unknown;

  constructor(context?: Partial<GitHubContext>, octokit?: unknown) {
    this.context = {
      repo: {
        owner: context?.repo?.owner || 'test-owner',
        repo: context?.repo?.repo || 'test-repo',
      },
      actor: context?.actor || 'test-actor',
      runId: context?.runId || 12345,
      eventName: context?.eventName || 'issue_comment',
      payload: context?.payload || {
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
    };
    this.octokitInstance = octokit;
  }

  getOctokit(_token: string): unknown {
    return this.octokitInstance;
  }

  setOctokit(octokit: unknown): void {
    this.octokitInstance = octokit;
  }
}
