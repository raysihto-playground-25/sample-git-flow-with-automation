import type { GitHub } from '@actions/github/lib/utils.js';
import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';

export interface ActionConfig {
  releaseBranchPrefix: string;
  developBranch: string;
  syncBranchPrefix: string;
  mergeableRetryCount: number;
  mergeableRetryInterval: number;
}

export interface EventContext {
  owner: string;
  repo: string;
  prNumber: number;
  commentId: number;
  commentBody: string;
  actor: string;
  userType: string;
  authorAssociation: string;
  serverUrl: string;
  runId: number;
  eventName: string;
  isPullRequest: boolean;
}

export interface PullRequestData {
  state: string;
  locked: boolean;
  draft: boolean;
  merged: boolean;
  mergeable: boolean | null;
  mergeableState: string;
  headSha: string;
  headRef: string;
  baseRef: string;
  author: string;
  isFork: boolean;
  title: string;
}

export interface CheckResult {
  name: string;
  passed: boolean;
  details?: string;
  optional?: boolean;
}

export interface MergeMethodResult {
  method: 'squash' | 'merge';
  reason: string;
}

export interface ActionResult {
  status: 'merged' | 'skipped' | 'failed' | 'already_merged';
  message: string;
  mergeMethod?: 'squash' | 'merge';
}

export interface MergeOptions {
  overrideApprovalRequirement: boolean;
}

export type Octokit = InstanceType<typeof GitHub>;

export type Review = RestEndpointMethodTypes['pulls']['listReviews']['response']['data'][number];
export type ReviewsArray = RestEndpointMethodTypes['pulls']['listReviews']['response']['data'];

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
