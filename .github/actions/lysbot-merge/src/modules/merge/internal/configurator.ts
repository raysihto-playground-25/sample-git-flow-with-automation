import { DefaultActionRunner, type ActionRunner } from './action-runner.js';
import type { CoreAdapter, GitHubAdapter } from './adapters.js';
import { DefaultMergeService } from './default-merge-service.js';
import type { MergeService } from './merge-service.js';

export interface MergeModuleDeps {
  mergeService: MergeService;
  actionRunner: ActionRunner;
}

export function configureMergeModule(core: CoreAdapter, github: GitHubAdapter): MergeModuleDeps {
  const mergeService: MergeService = new DefaultMergeService();
  const actionRunner: ActionRunner = new DefaultActionRunner({
    core,
    github,
    mergeService,
  });
  return { mergeService, actionRunner };
}
