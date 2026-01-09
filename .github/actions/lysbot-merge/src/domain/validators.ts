import {
  COMMAND_REGEX,
  CONVENTIONAL_COMMIT_REGEX,
  VALID_AUTHOR_ASSOCIATIONS,
  VALID_FLAGS,
  VALID_PERMISSIONS,
} from './constants.js';
import type { CheckResult, MergeOptions, PullRequestData } from './types.js';

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

export function isCommand(commentBody: string): boolean {
  return parseCommand(commentBody) !== null;
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

export function isConventionalCommitTitle(title: string): boolean {
  return CONVENTIONAL_COMMIT_REGEX.test(title);
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
