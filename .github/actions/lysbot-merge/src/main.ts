import * as core from '@actions/core';
import * as github from '@actions/github';

import { configureActionModule } from './modules/action/index.js';

export async function run(): Promise<void> {
  // Wire real GitHub Actions dependencies
  const actionModule = configureActionModule(core, github);

  // Execute via the action runner
  await actionModule.actionRunner.run();
}
