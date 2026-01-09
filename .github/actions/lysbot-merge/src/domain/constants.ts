export const COMMAND_REGEX = /^\s*\/lysbot\s+merge(?:\s+(.*))?\s*$/;

export const VALID_FLAGS = ['--override-approval-requirement'] as const;

export const CHECK_ICONS = {
  CHECK: '✅',
  CROSS: '❌',
  WARNING: '⚠️',
} as const;

export const VALID_AUTHOR_ASSOCIATIONS = ['OWNER', 'MEMBER', 'COLLABORATOR'] as const;

export const VALID_PERMISSIONS = ['admin', 'maintain', 'write'] as const;

export const CONVENTIONAL_COMMIT_TYPES = [
  'build',
  'chore',
  'ci',
  'docs',
  'feat',
  'fix',
  'perf',
  'refactor',
  'revert',
  'style',
  'test',
  'ux',
] as const;

export const CONVENTIONAL_COMMIT_REGEX = new RegExp(
  `^(${CONVENTIONAL_COMMIT_TYPES.join('|')})(\\([^)!]+\\))?!?:\\s*\\S.*$`,
);
