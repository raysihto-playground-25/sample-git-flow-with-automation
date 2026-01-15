/**
 * Interfaces for external dependencies (GitHub Actions SDK)
 * These interfaces allow us to inject dependencies instead of using vi.mock
 */

export interface CoreAdapter {
  getInput(name: string, options?: { required?: boolean }): string;
  setOutput(name: string, value: string): void;
  setFailed(message: string): void;
  info(message: string): void;
  summary: {
    addRaw(text: string): { write(): Promise<unknown> };
  };
}

export interface GitHubContext {
  repo: {
    owner: string;
    repo: string;
  };
  actor: string;
  runId: number;
  eventName: string;
  payload: {
    issue?: {
      number?: number;
      pull_request?: unknown;
    };
    comment?: {
      id?: number;
      body?: string;
      user?: {
        type?: string;
      };
      author_association?: string;
    };
  };
}

export interface GitHubAdapter {
  context: GitHubContext;
  getOctokit(token: string): unknown;
}
