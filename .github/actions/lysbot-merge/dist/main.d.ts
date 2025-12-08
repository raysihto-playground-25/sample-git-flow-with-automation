/**
 * main.ts - Entry point for the lysbot-merge GitHub Action
 *
 * This file is the main entry point that:
 * 1. Reads inputs from the GitHub Actions environment
 * 2. Constructs the event context from github.context
 * 3. Executes the main merge orchestration logic
 * 4. Sets outputs and handles errors
 *
 * FLOW OVERVIEW:
 * 1. Command validation - Check if comment is "/lysbot merge" (skip bots)
 * 2. Permission check - Verify OWNER/MEMBER/COLLABORATOR + write permission
 * 3. PR state check - Ensure PR is open, unlocked, not draft, not from fork
 * 4. Review check - Dismiss stale approvals, require 1+ valid approval
 * 5. Thread check - Ensure all review conversations are resolved
 * 6. Mergeability check - Wait for GitHub to compute, verify no conflicts
 * 7. TOCTOU check - Re-verify HEAD SHA hasn't changed before merge
 * 8. Execute merge - Use squash or merge commit based on branch patterns
 */
import type { LysbotMergeConfig, EventContext, LysbotMergeResult, Octokit } from './types';
/**
 * Main function that orchestrates the lysbot-merge operation.
 *
 * This function:
 * 1. Validates the command and permissions
 * 2. Checks PR state and approval status
 * 3. Performs the merge if all checks pass
 * 4. Posts appropriate comments for feedback
 *
 * Exported for testing purposes.
 *
 * @param octokit - GitHub API client
 * @param context - Event context from GitHub Actions
 * @param config - Configuration options
 * @returns Result of the operation
 */
export declare function lysbotMerge(octokit: Octokit, context: EventContext, config: LysbotMergeConfig): Promise<LysbotMergeResult>;
