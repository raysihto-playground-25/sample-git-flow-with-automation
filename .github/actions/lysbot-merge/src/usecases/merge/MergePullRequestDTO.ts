/**
 * Input/Output DTOs for MergePullRequestUseCase
 *
 * These define the data structures that the use case accepts and returns.
 */

import type { MergeConfig } from '../../domain/services/MergeMethodService.js';

/**
 * Retry configuration for mergeable status checks
 */
export interface RetryConfig {
  /** Number of retries for mergeable status calculation */
  mergeableRetryCount: number;
  /** Interval in seconds between retries */
  mergeableRetryInterval: number;
}

/**
 * Input data for the merge PR use case
 */
export interface MergePullRequestInput {
  /** Repository owner */
  owner: string;
  /** Repository name */
  repo: string;
  /** PR number */
  prNumber: number;
  /** Comment ID that triggered the action */
  commentId: number;
  /** Comment body text */
  commentBody: string;
  /** User who made the comment */
  actor: string;
  /** Type of user (User, Bot, etc.) */
  userType: string;
  /** Author association with the repository */
  authorAssociation: string;
  /** GitHub event name (e.g., 'issue_comment') */
  eventName: string;
  /** Whether this is a PR comment (not an issue comment) */
  isPullRequest: boolean;
  /** Merge method configuration */
  mergeConfig: MergeConfig;
  /** Retry configuration */
  retryConfig: RetryConfig;
}

/**
 * Output result from the merge PR use case
 */
export interface MergePullRequestOutput {
  /** Final status of the operation */
  status: 'merged' | 'skipped' | 'failed' | 'already_merged';
  /** Detailed message about what happened */
  message: string;
  /** Merge method used (if merged) */
  mergeMethod?: 'squash' | 'merge';
}
