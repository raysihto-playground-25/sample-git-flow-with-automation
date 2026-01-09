/**
 * PullRequestValidator.ts - Domain service for PR validation
 *
 * This service encapsulates the business rules for validating
 * that a pull request is in the correct state for merging.
 */

import type { MergeCheck } from '../entities/MergeCheck.js';
import type { PullRequest } from '../entities/PullRequest.js';

/**
 * Domain service that validates pull request state.
 */
export class PullRequestValidator {
  /**
   * Validates that a PR is in the correct state for merging.
   *
   * @param pr - Pull request to validate
   * @returns Array of check results
   */
  validateState(pr: PullRequest): MergeCheck[] {
    const checks: MergeCheck[] = [];

    // Consolidated check: PR is ready for review (combines open, unlocked, and not draft checks)
    const isOpen = pr.state === 'open';
    const isUnlocked = !pr.locked;
    const isNotDraft = !pr.draft;
    const allPassed = isOpen && isUnlocked && isNotDraft;

    // Collect failure reasons
    const failureReasons: string[] = [];
    if (!isOpen) {
      failureReasons.push('currently closed');
    }
    if (!isUnlocked) {
      failureReasons.push('currently locked');
    }
    if (!isNotDraft) {
      failureReasons.push('currently a draft');
    }

    checks.push({
      name: 'PR is ready for review',
      passed: allPassed,
      ...(failureReasons.length > 0 && { details: failureReasons.join(', ') }),
    });

    return checks;
  }

  /**
   * Generates a human-readable description for a mergeable state.
   *
   * @param state - The mergeable_state from GitHub
   * @returns Human-readable description
   */
  getMergeableStateDescription(state: string): string {
    const descriptions: Record<string, string> = {
      dirty: 'has unresolved conflicts',
      blocked: 'blocked by status checks or branch protection',
      unstable: 'has failing status checks',
      behind: 'branch is behind base branch',
      unknown: 'mergeability not yet computed, please retry',
      has_hooks: 'blocked by external hooks',
      clean: 'ready to merge',
    };
    return descriptions[state] ?? `mergeable_state: ${state}`;
  }
}
