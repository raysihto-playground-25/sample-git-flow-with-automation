import type { ActionConfig, MergeMethodResult } from './types.js';

export function determineMergeMethod(headRef: string, baseRef: string, config: ActionConfig): MergeMethodResult {
  if (headRef.startsWith(config.releaseBranchPrefix)) {
    return {
      method: 'merge',
      reason: `Head branch \`${headRef}\` is a release branch (merge commit to preserve release history)`,
    };
  }
  if (headRef.startsWith(config.syncBranchPrefix)) {
    return {
      method: 'merge',
      reason: `Head branch \`${headRef}\` is a sync branch (merge commit to preserve back-merge history)`,
    };
  }

  if (baseRef.startsWith(config.releaseBranchPrefix)) {
    return {
      method: 'squash',
      reason: `Base branch \`${baseRef}\` is a release branch`,
    };
  }
  if (baseRef === config.developBranch) {
    return {
      method: 'squash',
      reason: `Base branch is \`${baseRef}\``,
    };
  }

  return {
    method: 'merge',
    reason: `Default merge commit for \`${headRef}\` into \`${baseRef}\``,
  };
}
