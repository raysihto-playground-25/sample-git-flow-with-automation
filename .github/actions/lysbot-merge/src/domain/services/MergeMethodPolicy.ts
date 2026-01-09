/**
 * MergeMethodPolicy.ts - Domain service for determining merge method
 *
 * This service encapsulates the business rules for choosing between
 * squash and merge commit strategies based on branch patterns.
 */

import type { MergeMethod } from '../value-objects/MergeMethod.js';

/**
 * Configuration for merge method policy.
 */
export interface MergeMethodConfig {
  /** Prefix for release branches (e.g., "release/") */
  releaseBranchPrefix: string;
  /** Name of the develop branch */
  developBranch: string;
  /** Prefix for sync branches used in back-merges */
  syncBranchPrefix: string;
}

/**
 * Domain service that determines the appropriate merge method based on branch patterns.
 *
 * Logic:
 * 1. If head branch starts with release prefix → merge (preserve release history)
 * 2. If head branch starts with sync prefix → merge (preserve back-merge history)
 * 3. If base branch starts with release prefix → squash (clean release branch)
 * 4. If base branch is develop → squash (clean develop branch)
 * 5. Otherwise → merge (default)
 */
export class MergeMethodPolicy {
  constructor(private readonly config: MergeMethodConfig) {}

  /**
   * Determines the merge method based on branch names.
   *
   * @param headRef - Head (source) branch name
   * @param baseRef - Base (target) branch name
   * @returns The merge method and reason
   */
  determine(headRef: string, baseRef: string): MergeMethod {
    // Check head branch patterns first
    if (headRef.startsWith(this.config.releaseBranchPrefix)) {
      return {
        method: 'merge',
        reason: `Head branch \`${headRef}\` is a release branch (merge commit to preserve release history)`,
      };
    }
    if (headRef.startsWith(this.config.syncBranchPrefix)) {
      return {
        method: 'merge',
        reason: `Head branch \`${headRef}\` is a sync branch (merge commit to preserve back-merge history)`,
      };
    }

    // Check base branch patterns
    if (baseRef.startsWith(this.config.releaseBranchPrefix)) {
      return {
        method: 'squash',
        reason: `Base branch \`${baseRef}\` is a release branch`,
      };
    }
    if (baseRef === this.config.developBranch) {
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
}
