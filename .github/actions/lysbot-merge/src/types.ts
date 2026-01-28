/**
 * types.ts - Type definitions and interfaces for lysbot-merge
 *
 * This module contains all TypeScript type definitions and interfaces
 * used throughout the lysbot-merge action, including:
 * - Domain models (ActionConfig, EventContext, PullRequestData, etc.)
 * - Dependency injection interfaces (ActionsCore, GitHubContext, GetOctokitFunction, RuntimeEnvironment)
 * - Result types (ActionResult, CheckResult, MergeMethodResult, etc.)
 *
 * The DI interfaces follow these principles:
 * - Granular injection: Each dependency is a focused, single-purpose interface
 * - GitHubContext: Read-only context data from GitHub Actions
 * - GetOctokitFunction: Factory function to create Octokit instances
 * - RuntimeEnvironment: Centralized environment variable access
 * - All RunDependencies fields are required to prevent partial injection errors
 * - Fields are readonly to prevent mutation after construction
 */

import type { GitHub } from '@actions/github/lib/utils';
import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';

/**
 * Configuration options for the lysbot-merge action.
 * These are passed from the workflow inputs.
 */
export interface ActionConfig {
  /** Prefix for release branches (e.g., "release/") */
  releaseBranchPrefix: string;
  /** Name of the develop branch */
  developBranch: string;
  /** Prefix for sync branches used in back-merges */
  syncBranchPrefix: string;
  /** Number of retries for mergeable status calculation */
  mergeableRetryCount: number;
  /** Interval in seconds between retries */
  mergeableRetryInterval: number;
}

/**
 * Context from the GitHub event that triggered this action.
 */
export interface EventContext {
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
  /** Server URL for building links */
  serverUrl: string;
  /** Workflow run ID */
  runId: number;
  /** GitHub event name (e.g., 'issue_comment') */
  eventName: string;
  /** Whether this is a PR comment (not an issue comment) */
  isPullRequest: boolean;
}

/**
 * Pull request data fetched from GitHub API.
 */
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

/**
 * Individual check result for the merge checklist.
 */
export interface CheckResult {
  name: string;
  passed: boolean;
  details?: string;
  /** If true, this check does not block the merge even when it fails */
  optional?: boolean;
}

/**
 * Merge method and reason.
 */
export interface MergeMethodResult {
  method: 'squash' | 'merge';
  reason: string;
}

/**
 * Overall result of the lysbot-merge operation.
 */
export interface ActionResult {
  /** Final status of the operation */
  status: 'merged' | 'skipped' | 'failed' | 'already_merged';
  /** Detailed message about what happened */
  message: string;
  /** Merge method used (if merged) */
  mergeMethod?: 'squash' | 'merge';
}

/**
 * Options parsed from the `/lysbot merge` command.
 */
export interface MergeOptions {
  /**
   * When true, skip the "sufficient approvals" requirement.
   * All other checks (status checks, merge conflicts, labels, etc.) still apply.
   */
  overrideApprovalRequirement: boolean;
}

// Type alias for Octokit instance - using the original GitHub type
// which includes all necessary typing from @actions/github
export type Octokit = InstanceType<typeof GitHub>;

// Type aliases for GitHub API response types
export type ReviewsArray = RestEndpointMethodTypes['pulls']['listReviews']['response']['data'];

/**
 * Interface for GitHub Actions Core module.
 * This abstracts the @actions/core module for dependency injection.
 */
export interface ActionsCore {
  getInput(this: void, name: string, options?: { required?: boolean }): string;
  setOutput(this: void, name: string, value: string): void;
  setFailed(this: void, message: string): void;
  info(this: void, message: string): void;
  summary: {
    addRaw(this: void, text: string): { write(this: void): Promise<unknown> };
  };
}

/**
 * Interface for GitHub context.
 * This abstracts the github.context for dependency injection.
 */
export interface GitHubContext {
  repo: {
    owner: string;
    repo: string;
  };
  actor: string;
  runId: number;
  eventName: string;
  payload: {
    issue?: {
      number?: number;
      pull_request?: unknown;
    };
    comment?: {
      id?: number;
      body?: string;
      user?: {
        type?: string;
      };
      author_association?: string;
    };
  };
}

/**
 * Type for the Octokit factory function.
 * This is the actual getOctokit function, not a wrapper interface.
 */
export type GetOctokitFunction = (token: string) => Octokit;

/**
 * Interface for runtime environment configuration.
 * This abstracts environment variables and runtime settings.
 */
export interface RuntimeEnvironment {
  readonly serverUrl: string;
}

/**
 * Dependencies required by the main run() function.
 * This enables dependency injection and testing.
 * All fields are required to prevent partial injection errors.
 * Dependencies are injected at a granular level for better testability.
 */
export interface RunDependencies {
  readonly core: ActionsCore;
  readonly context: GitHubContext;
  readonly getOctokit: GetOctokitFunction;
  readonly env: RuntimeEnvironment;
}
