/**
 * MergeMethodService - Domain service for determining merge methods
 *
 * This service encapsulates the business logic for determining which merge
 * method to use based on branch names and configuration.
 */

import type { MergeMethod } from '../value-objects/MergeMethod.js';

/**
 * Configuration for merge method determination.
 * This is defined in the domain layer because it represents business rules.
 */
export interface MergeConfig {
  /** Prefix for release branches (e.g., "release/") */
  releaseBranchPrefix: string;
  /** Name of the develop branch */
  developBranch: string;
  /** Prefix for sync branches used in back-merges */
  syncBranchPrefix: string;
}

/**
 * Determines the merge method based on branch names.
 *
 * Logic:
 * 1. If head branch starts with release prefix → merge (preserve release history)
 * 2. If head branch starts with sync prefix → merge (preserve back-merge history)
 * 3. If base branch starts with release prefix → squash (clean release branch)
 * 4. If base branch is develop → squash (clean develop branch)
 * 5. Otherwise → merge (default)
 *
 * @param headRef - Head (source) branch name
 * @param baseRef - Base (target) branch name
 * @param config - Configuration with branch prefixes
 * @returns The merge method and reason
 */
export function determineMergeMethod(headRef: string, baseRef: string, config: MergeConfig): MergeMethod {
  // Check head branch patterns first
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

  // Check base branch patterns
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

  // Default to merge commit
  return {
    method: 'merge',
    reason: `Default merge commit for \`${headRef}\` into \`${baseRef}\``,
  };
}
