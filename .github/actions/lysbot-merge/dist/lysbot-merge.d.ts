/**
 * lysbot-merge.ts - Re-export module for backward compatibility
 *
 * This file serves as a re-export module to maintain backward compatibility
 * with existing code that imports from lysbot-merge.ts. All functionality
 * has been split into separate modules for better maintainability:
 *
 * - types.ts: Type definitions and interfaces
 * - constants.ts: Constants and configuration values
 * - validation.ts: Pure validation and business logic functions
 * - github-api.ts: GitHub API interaction functions
 * - merge-orchestrator.ts: Main orchestration logic
 *
 * THIRD-PARTY LICENSES:
 * - Twemoji graphics (https://github.com/twitter/twemoji) are used for emoji
 *   display compatibility. Licensed under CC-BY 4.0.
 *   Copyright 2020 Twitter, Inc and other contributors
 */
export type { LysbotMergeConfig, EventContext, PullRequestData, ValidationResult, CheckResult, MergeMethodResult, LysbotMergeResult, MergeOptions, Octokit, Review, ReviewsArray, } from './types';
export { COMMAND_REGEX, VALID_FLAGS, TWEMOJI, VALID_AUTHOR_ASSOCIATIONS, VALID_PERMISSIONS, CONVENTIONAL_COMMIT_TYPES, CONVENTIONAL_COMMIT_REGEX, } from './constants';
export { isConventionalCommitTitle, parseLysbotMergeCommand, isLysbotMergeCommand, isBot, hasValidAuthorAssociation, hasValidPermission, determineMergeMethod, validatePRState, getMergeableStateDescription, buildCheckResultsMarkdown, waitBeforeRetryMs, } from './validation';
export { addReaction, postComment, getCollaboratorPermission, fetchPullRequestData, fetchApprovedReviews, dismissReview, countUnresolvedThreads, mergePullRequest, } from './github-api';
export { lysbotMerge } from './merge-orchestrator';
