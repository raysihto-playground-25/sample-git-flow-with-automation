import type { GithubClient, PullRequestService } from '../../github/index.js';
import type { WaitService } from '../../merge/index.js';
import type { CommandParser, PrValidator, MarkdownBuilder } from '../../validation/index.js';

import { DefaultActionExecutor, type ActionExecutor } from './action-executor.js';

export interface ActionModuleDeps {
  actionExecutor: ActionExecutor;
}

export function configureActionModule(
  githubClient: GithubClient,
  pullRequestService: PullRequestService,
  commandParser: CommandParser,
  prValidator: PrValidator,
  markdownBuilder: MarkdownBuilder,
  waitService: WaitService,
): ActionModuleDeps {
  const actionExecutor: ActionExecutor = new DefaultActionExecutor(
    githubClient,
    pullRequestService,
    commandParser,
    prValidator,
    markdownBuilder,
    waitService,
  );

  return {
    actionExecutor,
  };
}
