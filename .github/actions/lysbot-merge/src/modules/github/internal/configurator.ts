import { DefaultGithubClient, type GithubClient } from './github-client.js';
import { DefaultPullRequestService, type PullRequestService } from './pull-request-service.js';
import type { Octokit } from './types.js';

export interface GithubModuleDeps {
  githubClient: GithubClient;
  pullRequestService: PullRequestService;
  octokit: Octokit;
}

export function configureGithubModule(octokit: Octokit): GithubModuleDeps {
  const githubClient: GithubClient = new DefaultGithubClient(octokit);
  const pullRequestService: PullRequestService = new DefaultPullRequestService(octokit);

  return {
    githubClient,
    pullRequestService,
    octokit,
  };
}
