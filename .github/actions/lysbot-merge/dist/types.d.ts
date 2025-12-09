/**
 * types.ts - Type definitions and interfaces for lysbot-merge
 *
 * This module contains all TypeScript type definitions and interfaces
 * used throughout the lysbot-merge action.
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
 * Result of validation checks.
 */
export interface ValidationResult {
    /** Whether validation passed */
    valid: boolean;
    /** Reason for failure (if any) */
    reason?: string;
    /** User-friendly message to post as comment */
    message?: string;
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
export type Octokit = InstanceType<typeof GitHub>;
export type Review = RestEndpointMethodTypes['pulls']['listReviews']['response']['data'][number];
export type ReviewsArray = RestEndpointMethodTypes['pulls']['listReviews']['response']['data'];
