import * as core from '@actions/core';
import * as github from '@actions/github';

import { configureMergeModule } from './modules/merge/index.js';

export async function run(): Promise<void> {
  // Wire real GitHub Actions dependencies
  const mergeModule = configureMergeModule(core, github);

  // Execute via the action runner
  await mergeModule.actionRunner.run();
}
