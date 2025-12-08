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

import * as core from '@actions/core';
import * as github from '@actions/github';
import type { LysbotMergeConfig, EventContext, LysbotMergeResult, CheckResult, Octokit } from './types';
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
      `## Permission denied\n\n> [!CAUTION]\n> Only repository owners, members, and collaborators can use the \`/lysbot merge\` command.\n>\n> Your association: \`${authorAssociation}\``,
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
      `## Permission denied\n\n> [!CAUTION]\n> You need at least **write** permission on this repository to use the \`/lysbot merge\` command.\n>\n> Your association: \`${authorAssociation}\`\n> Your permission level: \`${permission}\``,
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
      '## Fork PR not supported\n\n> [!WARNING]\n> The `/lysbot merge` command is not supported for PRs from forked repositories.\n>\n> This is because the GITHUB_TOKEN has limited write permissions for fork-originated PRs by default.',
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
    const staleComment = `## Stale approval dismiss failures\n\n> [!WARNING]\n> The following approvals could not be dismissed (consider enabling "Dismiss stale pull request approvals when new commits are pushed" in branch protection settings):\n>\n${dismissFailures.map((f) => `> ${f}`).join('\n')}`;
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
      `## New commits detected\n\n> [!WARNING]\n> New commits were pushed while validating this PR.\n>\n> - Original HEAD SHA: ${originalHeadSha}\n> - Current HEAD SHA: ${prData.headSha}\n>\n> Please run \`/lysbot merge\` again after the new commits are reviewed and approved.`,
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
        `## New commits detected\n\n> [!WARNING]\n> New commits were pushed while validating this PR (after waiting for mergeable status).\n>\n> - Original HEAD SHA: ${originalHeadSha}\n> - Current HEAD SHA: ${prData.headSha}\n>\n> Please run \`/lysbot merge\` again after the new commits are reviewed and approved.`,
      );
      return { status: 'failed', message: 'TOCTOU violation during retry' };
    }
  }

  // Check final mergeability
  if (prData.mergeable === false || prData.mergeable === null || prData.mergeableState === 'dirty') {
    let errorComment: string;
    if (prData.mergeable === null) {
      errorComment = `## Mergeability status pending\n\n> [!NOTE]\n> GitHub is still calculating mergeability for this PR.\n>\n> - Mergeable: \`null\`\n> - Mergeable State: \`${prData.mergeableState}\`\n> - Retries: count=${config.mergeableRetryCount}, interval=${config.mergeableRetryInterval}s\n>\n> Please try \`/lysbot merge\` again shortly.`;
    } else if (prData.mergeableState === 'dirty') {
      errorComment = `## Conflicts detected\n\n> [!CAUTION]\n> This PR has merge conflicts that must be resolved before merging.\n>\n> - Mergeable: \`${prData.mergeable}\`\n> - Mergeable State: \`${prData.mergeableState}\`\n>\n> Please resolve the conflicts and try again.`;
    } else {
      errorComment = `## Cannot merge\n\n> [!CAUTION]\n> This PR cannot be merged:\n>\n> - Mergeable: \`${prData.mergeable}\`\n> - Mergeable State: \`${prData.mergeableState}\`\n>\n> Please resolve any conflicts or issues before attempting to merge.`;
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
      `## Merge failed\n\n> [!CAUTION]\n> Failed to merge PR:\n>\n> - Error: ${mergeResult.error}\n>\n> Please check the PR status and try again.`,
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

/**
 * Writes a summary of the lysbot-merge operation to the GitHub Actions step summary.
 */
function writeSummary(
  result: string,
  prNumber: number,
  actor: string,
  headRef?: string,
  baseRef?: string,
  mergeMethod?: string,
  headSha?: string,
): void {
  let summary = `## lysbot-merge Summary\n\n`;
  summary += `| Item | Value |\n`;
  summary += `|------|-------|\n`;
  summary += `| **Result** | ${result} |\n`;
  summary += `| **PR** | #${prNumber} |\n`;
  summary += `| **Triggered by** | @${actor} |\n`;

  if (headRef && baseRef) {
    summary += `| **Head Branch** | \`${headRef}\` |\n`;
    summary += `| **Base Branch** | \`${baseRef}\` |\n`;
  }

  if (mergeMethod) {
    summary += `| **Merge Method** | \`${mergeMethod}\` |\n`;
  }

  if (headSha) {
    summary += `| **HEAD SHA** | ${headSha} |\n`;
  }

  core.summary.addRaw(summary).write();
}

/**
 * Main function that runs the action.
 */
async function run(): Promise<void> {
  try {
    // Get inputs
    const token = core.getInput('github-token', { required: true });
    const config: LysbotMergeConfig = {
      releaseBranchPrefix: core.getInput('release_branch_prefix') || 'release/',
      developBranch: core.getInput('develop_branch') || 'develop',
      syncBranchPrefix: core.getInput('sync_branch_prefix') || 'fix/sync/',
      mergeableRetryCount: parseInt(core.getInput('mergeable_retry_count') || '5', 10),
      mergeableRetryInterval: parseInt(core.getInput('mergeable_retry_interval') || '10', 10),
    };

    // Get event context
    const payload = github.context.payload;

    // Validate event type - this action only works with issue_comment events on PRs
    if (github.context.eventName !== 'issue_comment') {
      core.info('This action only runs on issue_comment events');
      core.setOutput('result', 'skipped');
      return;
    }

    // Check if this is a PR comment (not an issue comment)
    if (!payload.issue?.pull_request) {
      core.info('Comment is not on a PR, skipping');
      core.setOutput('result', 'skipped');
      return;
    }

    // Build event context
    const context: EventContext = {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      prNumber: payload.issue.number,
      commentId: payload.comment?.id ?? 0,
      commentBody: payload.comment?.body ?? '',
      actor: github.context.actor,
      userType: payload.comment?.user?.type ?? 'User',
      authorAssociation: payload.comment?.author_association ?? 'NONE',
      serverUrl: process.env.GITHUB_SERVER_URL ?? 'https://github.com',
      runId: github.context.runId,
    };

    // Create Octokit instance
    const octokit = github.getOctokit(token);

    // Run the main logic
    const result = await lysbotMerge(octokit, context, config);

    // Set outputs
    core.setOutput('result', result.status);
    if (result.mergeMethod) {
      core.setOutput('merge_method', result.mergeMethod);
    }

    // Write summary
    const resultEmoji = {
      merged: '✅ Merged successfully',
      skipped: '⏭️ Skipped',
      failed: '❌ Failed',
      already_merged: 'ℹ️ Already merged',
    }[result.status];

    writeSummary(
      resultEmoji,
      context.prNumber,
      context.actor,
      undefined, // headRef not available in this scope
      undefined, // baseRef not available in this scope
      result.mergeMethod,
      undefined, // headSha not available in this scope
    );

    // Log result
    core.info(`lysbot-merge result: ${result.status} - ${result.message}`);

    // Mark as failed if the result status is failed
    if (result.status === 'failed') {
      // Don't fail the workflow - failures are communicated via PR comments
      core.info('Merge checks or operation failed. See PR comments for details.');
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    core.setFailed(`lysbot-merge action failed: ${message}`);
  }
}

// Run the action
run();
