/**
 * action.ts - Testable action logic for the lysbot-merge GitHub Action
 *
 * This file contains the main business logic that can be unit tested:
 * 1. executeAction() - The main orchestration function for merge operations
 * 2. buildSummaryMarkdown() - Helper to build summary markdown
 *
 * This is separated from main.ts which contains untestable GitHub Actions runtime code.
 */

import * as core from '@actions/core';
import type { ActionConfig, EventContext, ActionResult, CheckResult, Octokit } from './types';
import {
  isBot,
  isCommand,
  parseCommand,
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
  fetchPullRequestCommits,
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
export async function executeAction(
  octokit: Octokit,
  context: EventContext,
  config: ActionConfig,
): Promise<ActionResult> {
  const { owner, repo, prNumber, commentId, commentBody, actor, userType, authorAssociation } = context;

  // -------------------------------------------------------------------------
  // Step 1: Validate command and user
  // -------------------------------------------------------------------------

  // Skip if bot
  if (isBot(userType)) {
    return { status: 'skipped', message: 'Comment is from a bot' };
  }

  // Check if this is the merge command
  if (!isCommand(commentBody)) {
    return { status: 'skipped', message: 'Command not matched' };
  }

  // Parse merge options from the command
  const mergeOptions = parseCommand(commentBody);
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

  // PR state checks (open, unlocked, ready)
  const prStateChecks = validatePRState(prData);

  // Unresolved threads check
  const unresolvedCount = await countUnresolvedThreads(octokit, owner, repo, prNumber);
  const threadsCheck: CheckResult = {
    name: 'All review conversations are resolved',
    passed: unresolvedCount === 0,
    details: unresolvedCount > 0 ? `${unresolvedCount} unresolved` : undefined,
  };

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

  const approvalCheck: CheckResult = {
    name: 'At least one valid approval from another user',
    passed: approvalCheckPassed,
    details: approvalDetails,
    // Mark as optional when override flag is used, so it shows warning instead of failure
    optional: approvalOverridden,
  };

  // Merge conflicts check (based on mergeable_state)
  const noConflicts = prData.mergeableState === 'clean';
  const conflictsCheck: CheckResult = {
    name: 'No merge conflicts',
    passed: noConflicts,
    details: !noConflicts ? getMergeableStateDescription(prData.mergeableState) : undefined,
  };

  // Optional: Conventional Commits check for PR title
  const isConventionalTitle = isConventionalCommitTitle(prData.title);
  const conventionalCommitsCheck: CheckResult = {
    name: 'PR title follows [Conventional Commits](https://www.conventionalcommits.org/)',
    passed: isConventionalTitle,
    details: !isConventionalTitle ? 'title does not follow conventional format' : undefined,
    optional: true,
  };

  // Determine merge method
  const mergeMethodResult = determineMergeMethod(prData.headRef, prData.baseRef, config);

  // Build checks array in the final order directly
  const checks: CheckResult[] = [
    ...prStateChecks,
    threadsCheck,
    approvalCheck,
    conflictsCheck,
    conventionalCommitsCheck,
  ];

  // Build results markdown
  const checksMarkdown = buildCheckResultsMarkdown(checks);
  // Only required (non-optional) checks must pass
  const allPassed = checks.filter((c) => !c.optional).every((c) => c.passed);

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
  // Build explicit commit title and message according to lysbot-merge specification
  let commitTitle: string;
  let commitBody: string;

  // Build additional metadata that goes in the commit body
  let additionalMessages = `Merged-by: lysbot-merge (on behalf of @${actor})`;
  if (approvalOverridden) {
    additionalMessages += `\n\n⚠️ EXCEPTIONAL MERGE: Approval requirement overridden via --override-approval-requirement`;
  }

  if (mergeMethodResult.method === 'merge') {
    // For merge commits:
    // Title: Merge pull request #{PR_NUMBER} from {PR_MERGE_HEAD}
    // Body: {PR_TITLE}\n\n{ADDITIONAL_MESSAGES}
    commitTitle = `Merge pull request #${prNumber} from ${prData.headRef}`;
    commitBody = `${prData.title}\n\n${additionalMessages}`;
  } else {
    // For squash commits:
    // Title: {PR_TITLE} (#{PR_NUMBER})
    // Body: * {COMMIT_TITLE_01}\n* {COMMIT_TITLE_02}\n...\n\nCo-authored-by: ...\n\n{ADDITIONAL_MESSAGES}
    commitTitle = `${prData.title} (#${prNumber})`;

    // Fetch commits to list their titles and collect co-authors
    const commits = await fetchPullRequestCommits(octokit, owner, repo, prNumber);
    const commitTitles = commits
      .map((c) => {
        // Extract first line of commit message (commit title)
        const message = c.commit.message || '';
        const firstLine = message.split('\n')[0];
        return firstLine ? `* ${firstLine}` : '';
      })
      .filter((title) => title !== ''); // Filter out empty entries

    // Collect unique co-authors from commits in order
    // Use array to preserve commit order (older ancestor -> recent ancestor)
    const coAuthors: string[] = [];
    commits.forEach((c) => {
      const author = c.commit.author;
      if (author?.name && author?.email) {
        // Create unique key for author
        const authorLine = `Co-authored-by: ${author.name} <${author.email}>`;
        if (!coAuthors.includes(authorLine)) {
          coAuthors.push(authorLine);
        }
      }
    });

    // Build commit body with commit titles, co-authors, and additional messages
    const bodyParts: string[] = [];

    if (commitTitles.length > 0) {
      bodyParts.push(commitTitles.join('\n'));
    }

    if (coAuthors.length > 0) {
      bodyParts.push(coAuthors.join('\n'));
    }

    bodyParts.push(additionalMessages);

    commitBody = bodyParts.join('\n\n');
  }

  const mergeResult = await mergePullRequest(
    octokit,
    owner,
    repo,
    prNumber,
    mergeMethodResult.method,
    originalHeadSha,
    commitTitle,
    commitBody,
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
export function buildSummaryMarkdown(
  result: string,
  prNumber: number,
  actor: string,
  mergeMethod?: string,
): string {
  let summary = `## lysbot-merge Summary\n\n`;
  summary += `| Item | Value |\n`;
  summary += `|------|-------|\n`;
  summary += `| **Result** | ${result} |\n`;
  summary += `| **PR** | #${prNumber} |\n`;
  summary += `| **Triggered by** | @${actor} |\n`;

  if (mergeMethod) {
    summary += `| **Merge Method** | \`${mergeMethod}\` |\n`;
  }

  return summary;
}
