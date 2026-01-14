export const COMMAND_REGEX = /^\s*\/lysbot\s+merge(?:\s+(.*))?\s*$/;

export const VALID_FLAGS = ['--override-approval-requirement'] as const;

export const TWEMOJI = {
  CHECK:
    '<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/2705.svg" width="20" height="20" alt="OK">',
  CROSS:
    '<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/274c.svg" width="20" height="20" alt="NG">',
  WARNING:
    '<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/26a0.svg" width="20" height="20" alt="Warning">',
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
