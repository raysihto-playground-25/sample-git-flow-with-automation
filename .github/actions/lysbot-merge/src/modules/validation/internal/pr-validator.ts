import type { PullRequestData } from '../../github/index.js';
import type { ActionConfig } from '../../config/index.js';
import { CONVENTIONAL_COMMIT_REGEX } from '../../config/index.js';
import type { CheckResult, MergeMethodResult } from './types.js';

export interface PrValidator {
  validatePRState(prData: PullRequestData): CheckResult[];
  isConventionalCommitTitle(title: string): boolean;
  determineMergeMethod(headRef: string, baseRef: string, config: ActionConfig): MergeMethodResult;
  getMergeableStateDescription(state: string): string;
}

export class DefaultPrValidator implements PrValidator {
  validatePRState(prData: PullRequestData): CheckResult[] {
    const checks: CheckResult[] = [];

    const isOpen = prData.state === 'open';
    const isUnlocked = !prData.locked;
    const isNotDraft = !prData.draft;
    const allPassed = isOpen && isUnlocked && isNotDraft;

    const failureReasons: string[] = [];
    if (!isOpen) {
      failureReasons.push('currently closed');
    }
    if (!isUnlocked) {
      failureReasons.push('currently locked');
    }
    if (!isNotDraft) {
      failureReasons.push('currently a draft');
    }

    checks.push({
      name: 'PR is ready for review',
      passed: allPassed,
      ...(failureReasons.length > 0 && { details: failureReasons.join(', ') }),
    });

    return checks;
  }

  isConventionalCommitTitle(title: string): boolean {
    return CONVENTIONAL_COMMIT_REGEX.test(title);
  }

  determineMergeMethod(headRef: string, baseRef: string, config: ActionConfig): MergeMethodResult {
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

  getMergeableStateDescription(state: string): string {
    const descriptions: Record<string, string> = {
      dirty: 'has unresolved conflicts',
      blocked: 'blocked by status checks or branch protection',
      unstable: 'has failing status checks',
      behind: 'branch is behind base branch',
      unknown: 'mergeability not yet computed, please retry',
      has_hooks: 'blocked by external hooks',
      clean: 'ready to merge',
    };
    return descriptions[state] ?? `mergeable_state: ${state}`;
  }
}
