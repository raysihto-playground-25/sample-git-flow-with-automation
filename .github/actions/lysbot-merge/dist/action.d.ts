/**
 * action.ts - Testable action logic for the lysbot-merge GitHub Action
 *
 * This file contains the main business logic that can be unit tested:
 * 1. lysbotMerge() - The main orchestration function for merge operations
 * 2. buildSummaryMarkdown() - Helper to build summary markdown
 *
 * This is separated from main.ts which contains untestable GitHub Actions runtime code.
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
/**
 * Builds a summary markdown table for the lysbot-merge operation.
 *
 * This is a pure function that can be tested without GitHub Actions environment.
 *
 * @param result - Result status emoji and message
 * @param prNumber - PR number
 * @param actor - User who triggered the action
 * @param headRef - Optional head branch name
 * @param baseRef - Optional base branch name
 * @param mergeMethod - Optional merge method used
 * @param headSha - Optional HEAD SHA
 * @returns Markdown string for the summary
 */
export declare function buildSummaryMarkdown(result: string, prNumber: number, actor: string, headRef?: string, baseRef?: string, mergeMethod?: string, headSha?: string): string;
