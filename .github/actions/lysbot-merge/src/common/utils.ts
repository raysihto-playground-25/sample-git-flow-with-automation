import {
  COMMAND_REGEX,
  CONVENTIONAL_COMMIT_REGEX,
  TWEMOJI,
  VALID_AUTHOR_ASSOCIATIONS,
  VALID_FLAGS,
  VALID_PERMISSIONS,
} from './constants.js';
import type { ActionConfig, CheckResult, MergeMethodResult, MergeOptions, PullRequestData } from './types.js';

export function parseCommand(commentBody: string): MergeOptions | null {
  const match = COMMAND_REGEX.exec(commentBody);
  if (!match) {
    return null;
  }

  const flagsStr = match[1]?.trim() ?? '';
  const flags = flagsStr ? flagsStr.split(/\s+/) : [];

  const validFlagsArray: readonly string[] = VALID_FLAGS;
  if (!flags.every((flag) => validFlagsArray.includes(flag))) {
    return null;
  }

  return {
    overrideApprovalRequirement: flags.includes('--override-approval-requirement'),
  };
}

export function isBot(userType: string): boolean {
  return userType === 'Bot';
}

export function hasValidAuthorAssociation(association: string): boolean {
  return (VALID_AUTHOR_ASSOCIATIONS as readonly string[]).includes(association);
}

export function hasValidPermission(permission: string): boolean {
  return (VALID_PERMISSIONS as readonly string[]).includes(permission);
}

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

export function validatePRState(prData: PullRequestData): CheckResult[] {
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

export function getMergeableStateDescription(state: string): string {
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

export function buildCheckResultsMarkdown(checks: CheckResult[]): string {
  return checks
    .map((check) => {
      let icon: string;
      if (check.passed) {
        icon = TWEMOJI.CHECK;
      } else if (check.optional) {
        icon = TWEMOJI.WARNING;
      } else {
        icon = TWEMOJI.CROSS;
      }
      const detail = check.details ? ` (${check.details})` : '';
      return `- ${icon} ${check.name}${detail}`;
    })
    .join('\n');
}

export function isConventionalCommitTitle(title: string): boolean {
  return CONVENTIONAL_COMMIT_REGEX.test(title);
}

export function waitBeforeRetryMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildSummaryMarkdown(result: string, prNumber: number, actor: string, mergeMethod?: string): string {
  let summary = `## lysbot-merge Summary\n\n`;
  summary += `| Item | Value |\n`;
  summary += `|------|-------|\n`;
  summary += `| **Result** | ${result} |\n`;
  summary += `| **PR** | #${prNumber} |\n`;
  summary += `| **Triggered by** | @${actor} |\n`;

  if (mergeMethod) {
    summary += `| **Merge Method** | \`${mergeMethod}\` |\n`;
  }

  return summary;
}
