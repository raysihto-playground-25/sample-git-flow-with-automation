import * as core from '@actions/core';
import * as github from '@actions/github';

import { configureActionModule } from './modules/action/index.js';

export async function run(): Promise<void> {
  const actionModule = configureActionModule(core, github);
  await actionModule.actionRunner.run();
}
