/**
 * github-api.ts - GitHub API interaction functions
 *
 * This module contains all functions that interact with the GitHub API.
 * These functions handle API calls, data fetching, and mutations.
 */
import type { Octokit, PullRequestData, ReviewsArray } from './types';
/**
 * Adds a reaction to a comment.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param commentId - Comment ID
 * @param reaction - Reaction to add
 */
export declare function addReaction(octokit: Octokit, owner: string, repo: string, commentId: number, reaction: '+1' | '-1' | 'laugh' | 'confused' | 'heart' | 'hooray' | 'rocket' | 'eyes'): Promise<void>;
/**
 * Posts a comment on a PR.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - PR number
 * @param body - Comment body
 */
export declare function postComment(octokit: Octokit, owner: string, repo: string, prNumber: number, body: string): Promise<void>;
/**
 * Gets the collaborator permission level for a user.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param username - Username to check
 * @returns Permission level or 'none' on failure
 */
export declare function getCollaboratorPermission(octokit: Octokit, owner: string, repo: string, username: string): Promise<string>;
/**
 * Fetches PR data from GitHub API.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - PR number
 * @returns Pull request data
 */
export declare function fetchPullRequestData(octokit: Octokit, owner: string, repo: string, prNumber: number): Promise<PullRequestData>;
/**
 * Fetches all approved reviews for a PR.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - PR number
 * @returns Array of approved reviews
 */
export declare function fetchApprovedReviews(octokit: Octokit, owner: string, repo: string, prNumber: number): Promise<ReviewsArray>;
/**
 * Dismisses a stale review.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - PR number
 * @param reviewId - Review ID to dismiss
 * @param message - Dismissal message
 * @returns true if dismissed successfully
 */
export declare function dismissReview(octokit: Octokit, owner: string, repo: string, prNumber: number, reviewId: number, message: string): Promise<boolean>;
/**
 * Counts unresolved review threads using GraphQL.
 * Why: REST API doesn't provide review thread resolution status, GraphQL is required.
 * Note: Counts ALL unresolved threads including outdated ones, matching GitHub's
 * "Require conversations to be resolved" branch protection behavior.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - PR number
 * @returns Number of unresolved threads
 */
export declare function countUnresolvedThreads(octokit: Octokit, owner: string, repo: string, prNumber: number): Promise<number>;
/**
 * Fetches the list of commits in a PR.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - PR number
 * @returns Array of commit objects with commit message and author information
 */
export declare function fetchPullRequestCommits(octokit: Octokit, owner: string, repo: string, prNumber: number): Promise<Array<{
    commit: {
        message: string;
        author?: {
            name?: string;
            email?: string;
        } | null;
    };
}>>;
/**
 * Performs the merge operation.
 *
 * @param octokit - GitHub API client
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param prNumber - PR number
 * @param method - Merge method (squash or merge)
 * @param sha - Expected head SHA for TOCTOU check
 * @param commitTitle - Explicit commit title (first line of commit message)
 * @param commitMessage - Explicit commit message body (lines after the title and blank line)
 * @returns Object containing success status, error message, and merge commit SHA
 */
export declare function mergePullRequest(octokit: Octokit, owner: string, repo: string, prNumber: number, method: 'squash' | 'merge', sha: string, commitTitle: string, commitMessage: string): Promise<{
    success: boolean;
    error?: string;
    mergeCommitSha?: string;
}>;
