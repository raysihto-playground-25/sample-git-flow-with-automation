/**
 * merge-orchestrator.ts - Main orchestration logic for lysbot-merge
 *
 * This module contains the main lysbotMerge function that coordinates
 * all the validation steps, checks, and the actual merge operation.
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

import * as core from '@actions/core';
import type { EventContext, LysbotMergeConfig, LysbotMergeResult, CheckResult } from './types';
import {
  isBot,
  isLysbotMergeCommand,
  parseLysbotMergeCommand,
  hasValidAuthorAssociation,
  hasValidPermission,
  validatePRState,
  determineMergeMethod,
  getMergeableStateDescription,
  buildCheckResultsMarkdown,
  isConventionalCommitTitle,
  waitBeforeRetryMs,
} from './validation';
import {
  addReaction,
  postComment,
  getCollaboratorPermission,
  fetchPullRequestData,
  fetchApprovedReviews,
  dismissReview,
  countUnresolvedThreads,
  mergePullRequest,
} from './github-api';
import type { Octokit } from './types';

/**
 * Main function that orchestrates the lysbot-merge operation.
 *
 * This function:
 * 1. Validates the command and permissions
 * 2. Checks PR state and approval status
 * 3. Performs the merge if all checks pass
 * 4. Posts appropriate comments for feedback
 *
 * @param octokit - GitHub API client
 * @param context - Event context from GitHub Actions
 * @param config - Configuration options
 * @returns Result of the operation
 */
export async function lysbotMerge(
  octokit: Octokit,
  context: EventContext,
  config: LysbotMergeConfig,
): Promise<LysbotMergeResult> {
  const { owner, repo, prNumber, commentId, commentBody, actor, userType, authorAssociation } = context;

  // -------------------------------------------------------------------------
  // Step 1: Validate command and user
  // -------------------------------------------------------------------------

  // Skip if bot
  if (isBot(userType)) {
    return { status: 'skipped', message: 'Comment is from a bot' };
  }

  // Check if this is the lysbot merge command
  if (!isLysbotMergeCommand(commentBody)) {
    return { status: 'skipped', message: 'Command not matched' };
  }

  // Parse merge options from the command
  const mergeOptions = parseLysbotMergeCommand(commentBody);
  if (!mergeOptions) {
    return { status: 'skipped', message: 'Command not matched' };
  }

  // Add eyes reaction for immediate feedback
  await addReaction(octokit, owner, repo, commentId, 'eyes');

  // Check author association
  if (!hasValidAuthorAssociation(authorAssociation)) {
    await postComment(
      octokit,
      owner,
      repo,
      prNumber,
      `## Permission denied\n\nOnly repository owners, members, and collaborators can use the \`/lysbot merge\` command.\n\nYour association: \`${authorAssociation}\``,
    );
    return { status: 'failed', message: 'Invalid author association' };
  }

  // Check permission level
  const permission = await getCollaboratorPermission(octokit, owner, repo, actor);
  if (!hasValidPermission(permission)) {
    await postComment(
      octokit,
      owner,
      repo,
      prNumber,
      `## Permission denied\n\nYou need at least **write** permission on this repository to use the \`/lysbot merge\` command.\n\nYour association: \`${authorAssociation}\`\nYour permission level: \`${permission}\``,
    );
    return { status: 'failed', message: 'Insufficient permissions' };
  }

  // -------------------------------------------------------------------------
  // Step 2: Fetch and validate PR data
  // -------------------------------------------------------------------------

  let prData = await fetchPullRequestData(octokit, owner, repo, prNumber);

  // Why: GITHUB_TOKEN has limited write permissions for fork PRs by default.
  // Merge operations would fail, so we reject early with a clear message.
  if (prData.isFork) {
    await postComment(
      octokit,
      owner,
      repo,
      prNumber,
      '## Fork PR not supported\n\nThe `/lysbot merge` command is not supported for PRs from forked repositories.\n\nThis is because the GITHUB_TOKEN has limited write permissions for fork-originated PRs by default.',
    );
    return { status: 'failed', message: 'Fork PR not supported' };
  }

  // Check if already merged
  if (prData.merged) {
    await postComment(octokit, owner, repo, prNumber, '## Already merged\n\nThis PR has already been merged.');
    return { status: 'already_merged', message: 'PR already merged' };
  }

  // -------------------------------------------------------------------------
  // Step 3: Run all validation checks
  // -------------------------------------------------------------------------

  const checks: CheckResult[] = [];

  // PR state checks
  checks.push(...validatePRState(prData));

  // Approval check - fetch and validate reviews
  const approvedReviews = await fetchApprovedReviews(octokit, owner, repo, prNumber);
  let validApprovals = 0;
  const dismissFailures: string[] = [];

  for (const review of approvedReviews) {
    // Skip self-approval
    if (review.user?.login === prData.author) {
      continue;
    }

    // Check if review is stale (not on current HEAD)
    if (review.commit_id !== prData.headSha) {
      const message = `Approval dismissed: New commits were pushed after this review was submitted (reviewed commit: ${review.commit_id?.slice(0, 7)}, current HEAD: ${prData.headSha.slice(0, 7)}).`;
      const dismissed = await dismissReview(octokit, owner, repo, prNumber, review.id, message);
      if (!dismissed) {
        dismissFailures.push(
          `- Failed to dismiss approval from @${review.user?.login} (insufficient permissions or branch protection settings)`,
        );
      }
    } else {
      validApprovals++;
    }
  }

  // Post stale dismissal notification only when there are failures.
  // Success notifications are skipped because GitHub's native "approval dismissed"
  // notification already appears in the PR timeline when reviews are dismissed.
  if (dismissFailures.length > 0) {
    const staleComment = `## Stale approval dismiss failures\n\nThe following approvals could not be dismissed (consider enabling "Dismiss stale pull request approvals when new commits are pushed" in branch protection settings):\n\n${dismissFailures.join('\n')}`;
    await postComment(octokit, owner, repo, prNumber, staleComment);
  }

  // Determine if approval requirement is overridden
  const approvalCheckPassed = validApprovals >= 1;
  const approvalOverridden = mergeOptions.overrideApprovalRequirement && !approvalCheckPassed;

  // Log when approval requirement is overridden
  if (approvalOverridden) {
    core.info('Approval requirement overridden by command flag (--override-approval-requirement).');
  }

  // Build approval check result
  let approvalDetails: string | undefined;
  if (approvalCheckPassed) {
    approvalDetails = undefined;
  } else if (approvalOverridden) {
    approvalDetails = 'approval requirement overridden by `--override-approval-requirement`; no valid approvals found';
  } else {
    approvalDetails = 'no valid approvals found';
  }

  checks.push({
    name: 'At least one valid approval from another user',
    passed: approvalCheckPassed,
    details: approvalDetails,
    // Mark as optional when override flag is used, so it shows warning instead of failure
    optional: approvalOverridden,
  });

  // Unresolved threads check
  const unresolvedCount = await countUnresolvedThreads(octokit, owner, repo, prNumber);
  checks.push({
    name: 'All review conversations are resolved',
    passed: unresolvedCount === 0,
    details: unresolvedCount > 0 ? `${unresolvedCount} unresolved` : undefined,
  });

  // Merge conflicts check (based on mergeable_state)
  const noConflicts = prData.mergeableState === 'clean';
  checks.push({
    name: 'No merge conflicts',
    passed: noConflicts,
    details: !noConflicts ? getMergeableStateDescription(prData.mergeableState) : undefined,
  });

  // Optional: Conventional Commits check for PR title
  const isConventionalTitle = isConventionalCommitTitle(prData.title);
  checks.push({
    name: 'PR title follows [Conventional Commits](https://www.conventionalcommits.org/)',
    passed: isConventionalTitle,
    details: !isConventionalTitle ? 'title does not follow conventional format' : undefined,
    optional: true,
  });

  // Determine merge method
  const mergeMethodResult = determineMergeMethod(prData.headRef, prData.baseRef, config);

  // Build results markdown
  // Reorder checks to match workflow order: open, unlocked, ready, threads, approval, conflicts, optional checks
  const orderedChecks = [
    checks.find((c) => c.name === 'PR is open')!,
    checks.find((c) => c.name === 'PR is unlocked')!,
    checks.find((c) => c.name === 'PR is ready for review')!,
    checks.find((c) => c.name === 'All review conversations are resolved')!,
    checks.find((c) => c.name === 'At least one valid approval from another user')!,
    checks.find((c) => c.name === 'No merge conflicts')!,
    checks.find((c) => c.name.includes('Conventional Commits'))!,
  ];
  const checksMarkdown = buildCheckResultsMarkdown(orderedChecks);
  // Only required (non-optional) checks must pass
  const allPassed = orderedChecks.filter((c) => !c.optional).every((c) => c.passed);

  // -------------------------------------------------------------------------
  // Step 4: Report results and merge if all passed
  // -------------------------------------------------------------------------

  if (!allPassed) {
    await postComment(
      octokit,
      owner,
      repo,
      prNumber,
      `## Merge checks failed\n\nThe following checks must pass before merging:\n\n${checksMarkdown}\n\n### Merge Method\n\n- **Method:** \`${mergeMethodResult.method}\`\n- **Reason:** ${mergeMethodResult.reason}`,
    );
    return { status: 'failed', message: 'Merge checks failed' };
  }

  // All checks passed - post status and proceed to merge
  await postComment(
    octokit,
    owner,
    repo,
    prNumber,
    `## Merge checks passed\n\nAll checks passed. Proceeding to merge...\n\n${checksMarkdown}\n\n### Merge Method\n\n- **Method:** \`${mergeMethodResult.method}\`\n- **Reason:** ${mergeMethodResult.reason}`,
  );

  // -------------------------------------------------------------------------
  // Step 5: TOCTOU check and merge
  // -------------------------------------------------------------------------

  const originalHeadSha = prData.headSha;

  // Re-fetch PR data for TOCTOU check
  prData = await fetchPullRequestData(octokit, owner, repo, prNumber);

  if (prData.headSha !== originalHeadSha) {
    await postComment(
      octokit,
      owner,
      repo,
      prNumber,
      `## New commits detected\n\nNew commits were pushed while validating this PR.\n\n- Original HEAD SHA: ${originalHeadSha}\n- Current HEAD SHA: ${prData.headSha}\n\nPlease run \`/lysbot merge\` again after the new commits are reviewed and approved.`,
    );
    return { status: 'failed', message: 'TOCTOU violation' };
  }

  // Why: GitHub API returns mergeable=null while computing merge status asynchronously.
  // This typically happens on first fetch after PR update. We retry to wait for computation.
  let retries = 0;
  while (prData.mergeable === null && retries < config.mergeableRetryCount) {
    await waitBeforeRetryMs(config.mergeableRetryInterval * 1000);
    prData = await fetchPullRequestData(octokit, owner, repo, prNumber);
    retries++;

    // TOCTOU check during retry
    if (prData.headSha !== originalHeadSha) {
      await postComment(
        octokit,
        owner,
        repo,
        prNumber,
        `## New commits detected\n\nNew commits were pushed while validating this PR (after waiting for mergeable status).\n\n- Original HEAD SHA: ${originalHeadSha}\n- Current HEAD SHA: ${prData.headSha}\n\nPlease run \`/lysbot merge\` again after the new commits are reviewed and approved.`,
      );
      return { status: 'failed', message: 'TOCTOU violation during retry' };
    }
  }

  // Check final mergeability
  if (prData.mergeable === false || prData.mergeable === null || prData.mergeableState === 'dirty') {
    let errorComment: string;
    if (prData.mergeable === null) {
      errorComment = `## Mergeability status pending\n\nGitHub is still calculating mergeability for this PR.\n\n- Mergeable: \`null\`\n- Mergeable State: \`${prData.mergeableState}\`\n- Retries: count=${config.mergeableRetryCount}, interval=${config.mergeableRetryInterval}s\n\nPlease try \`/lysbot merge\` again shortly.`;
    } else if (prData.mergeableState === 'dirty') {
      errorComment = `## Conflicts detected\n\nThis PR has merge conflicts that must be resolved before merging.\n\n- Mergeable: \`${prData.mergeable}\`\n- Mergeable State: \`${prData.mergeableState}\`\n\nPlease resolve the conflicts and try again.`;
    } else {
      errorComment = `## Cannot merge\n\nThis PR cannot be merged:\n\n- Mergeable: \`${prData.mergeable}\`\n- Mergeable State: \`${prData.mergeableState}\`\n\nPlease resolve any conflicts or issues before attempting to merge.`;
    }
    await postComment(octokit, owner, repo, prNumber, errorComment);
    return { status: 'failed', message: 'Not mergeable' };
  }

  // Perform merge
  // Build commit message that will be appended to GitHub's automatic message
  let commitMessage = `Merged-by: lysbot-merge (on behalf of @${actor})`;

  // Add marker if approval requirement was overridden
  if (approvalOverridden) {
    commitMessage += `\n\n⚠️ EXCEPTIONAL MERGE: Approval requirement overridden via --override-approval-requirement`;
  }

  const mergeResult = await mergePullRequest(
    octokit,
    owner,
    repo,
    prNumber,
    mergeMethodResult.method,
    originalHeadSha,
    commitMessage,
  );

  if (!mergeResult.success) {
    await postComment(
      octokit,
      owner,
      repo,
      prNumber,
      `## Merge failed\n\nFailed to merge PR:\n\n- Error: ${mergeResult.error}\n\nPlease check the PR status and try again.`,
    );
    return { status: 'failed', message: `Merge failed: ${mergeResult.error}` };
  }

  // Post success comment with commit SHAs (GitHub auto-links them)
  let mergeCommitInfo = '';
  if (mergeResult.mergeCommitSha) {
    mergeCommitInfo = `\n- **Merge Commit SHA:** ${mergeResult.mergeCommitSha}`;
  }

  await postComment(
    octokit,
    owner,
    repo,
    prNumber,
    `## Merged by lysbot-merge\n\nThis PR has been successfully merged.\n\n### Details\n\n- **Merge Method:** \`${mergeMethodResult.method}\`\n- **Base Branch:** \`${prData.baseRef}\`\n- **Head Branch:** \`${prData.headRef}\`\n- **HEAD SHA:** ${originalHeadSha}${mergeCommitInfo}`,
  );

  return {
    status: 'merged',
    message: 'PR merged successfully',
    mergeMethod: mergeMethodResult.method,
  };
}
