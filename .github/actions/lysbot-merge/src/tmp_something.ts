import { buildConfigFromInputs, buildEventContext, getToken } from './adapter.js';
import type { ActionDependencies } from './dependencies.js';
import { createProductionDependencies } from './dependencies.js';
import { presentError, presentResult } from './presentation.js';
import { executeAction } from './tmp_anything.js';

export async function run(deps?: ActionDependencies): Promise<void> {
  const resolvedDeps = deps ?? (await createProductionDependencies());

  try {
    const token = getToken(resolvedDeps);
    const config = buildConfigFromInputs(resolvedDeps);
    const context = buildEventContext(resolvedDeps);
    const octokit = resolvedDeps.github.getOctokit(token);

    const result = await executeAction(octokit, context, config);

    await presentResult(resolvedDeps, result, context.prNumber, context.actor);
  } catch (error) {
    presentError(resolvedDeps, error);
  }
}
