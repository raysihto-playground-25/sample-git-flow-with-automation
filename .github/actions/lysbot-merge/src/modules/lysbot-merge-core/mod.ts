import * as core from '@actions/core';

import { buildCheckResultsMarkdown } from '../../formatting/markdown.js';
import { postComment } from '../../github-api/comments.js';
import { fetchPullRequestCommits } from '../../github-api/commits.js';
import { mergePullRequest } from '../../github-api/merge.js';
import { getCollaboratorPermission } from '../../github-api/permissions.js';
import { fetchPullRequestData } from '../../github-api/pull-requests.js';
import { addReaction } from '../../github-api/reactions.js';
import { fetchApprovedReviews, dismissReview } from '../../github-api/reviews.js';
import { countUnresolvedThreads } from '../../github-api/threads.js';
import { buildCommitTitle, buildCommitMessage } from '../../merge-logic/commit-builder.js';
import { determineMergeMethod } from '../../merge-logic/merge-method.js';
import type { ActionConfig, ActionResult, CheckResult, EventContext, Octokit } from '../../types/index.js';
import { parseCommand } from '../../validation/command-parser.js';
import { isConventionalCommitTitle } from '../../validation/merge-checks.js';
import { validatePRState, getMergeableStateDescription } from '../../validation/pr-state.js';
import { isBot, hasValidAuthorAssociation, hasValidPermission } from '../../validation/user-checks.js';

export function waitBeforeRetryMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function executeAction(
  octokit: Octokit,
  context: EventContext,
  config: ActionConfig,
): Promise<ActionResult> {
  const {
    owner,
    repo,
    prNumber,
    commentId,
    commentBody,
    actor,
    userType,
    authorAssociation,
    eventName,
    isPullRequest,
  } = context;

  if (eventName !== 'issue_comment') {
    return { status: 'skipped', message: 'This action only runs on issue_comment events' };
  }

  if (!isPullRequest) {
    return { status: 'skipped', message: 'Comment is not on a PR, skipping' };
  }

  if (isBot(userType)) {
    return { status: 'skipped', message: 'Comment is from a bot' };
  }

  const mergeOptions = parseCommand(commentBody);
  if (!mergeOptions) {
    return { status: 'skipped', message: 'Command not matched' };
  }

  await addReaction(octokit, owner, repo, commentId, 'eyes');

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

  let prData = await fetchPullRequestData(octokit, owner, repo, prNumber);

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

  if (prData.merged) {
    await postComment(octokit, owner, repo, prNumber, '## Already merged\n\nThis PR has already been merged.');
    return { status: 'already_merged', message: 'PR already merged' };
  }

  const prStateChecks = validatePRState(prData);

  const unresolvedCount = await countUnresolvedThreads(octokit, owner, repo, prNumber);
  const threadsCheck: CheckResult = {
    name: 'All review conversations are resolved',
    passed: unresolvedCount === 0,
    ...(unresolvedCount > 0 && { details: `${unresolvedCount} unresolved` }),
  };

  const approvedReviews = await fetchApprovedReviews(octokit, owner, repo, prNumber);
  let validApprovals = 0;
  const dismissFailures: string[] = [];

  for (const review of approvedReviews) {
    if (review.user?.login === prData.author) {
      continue;
    }

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

  if (dismissFailures.length > 0) {
    const staleComment = `## Stale approval dismiss failures\n\n> [!WARNING]\n> The following approvals could not be dismissed (consider enabling "Dismiss stale pull request approvals when new commits are pushed" in branch protection settings):\n>\n${dismissFailures.map((f) => `> ${f}`).join('\n')}`;
    await postComment(octokit, owner, repo, prNumber, staleComment);
  }

  const approvalCheckPassed = validApprovals >= 1;
  const approvalOverridden = mergeOptions.overrideApprovalRequirement && !approvalCheckPassed;

  if (approvalOverridden) {
    core.info('Approval requirement overridden by command flag (--override-approval-requirement).');
  }

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
    ...(approvalDetails !== undefined && { details: approvalDetails }),
    ...(approvalOverridden && { optional: true }),
  };

  const noConflicts = prData.mergeableState === 'clean';
  const conflictsCheck: CheckResult = {
    name: 'No merge conflicts',
    passed: noConflicts,
    ...(!noConflicts && { details: getMergeableStateDescription(prData.mergeableState) }),
  };

  const isConventionalTitle = isConventionalCommitTitle(prData.title);
  const conventionalCommitsCheck: CheckResult = {
    name: 'PR title follows [Conventional Commits](https://www.conventionalcommits.org/)',
    passed: isConventionalTitle,
    ...(!isConventionalTitle && { details: 'title does not follow conventional format' }),
    optional: true,
  };

  const mergeMethodResult = determineMergeMethod(prData.headRef, prData.baseRef, config);

  const checks: CheckResult[] = [
    ...prStateChecks,
    threadsCheck,
    approvalCheck,
    conflictsCheck,
    conventionalCommitsCheck,
  ];

  const checksMarkdown = buildCheckResultsMarkdown(checks);
  const allPassed = checks.filter((c) => !c.optional).every((c) => c.passed);

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

  await postComment(
    octokit,
    owner,
    repo,
    prNumber,
    `## Merge checks passed\n\nAll checks passed. Proceeding to merge...\n\n${checksMarkdown}\n\n### Merge Method\n\n- **Method:** \`${mergeMethodResult.method}\`\n- **Reason:** ${mergeMethodResult.reason}`,
  );

  const originalHeadSha = prData.headSha;

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

  let retries = 0;
  while (prData.mergeable === null && retries < config.mergeableRetryCount) {
    await waitBeforeRetryMs(config.mergeableRetryInterval * 1000);
    prData = await fetchPullRequestData(octokit, owner, repo, prNumber);
    retries++;

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

  const commits = await fetchPullRequestCommits(octokit, owner, repo, prNumber);

  const commitTitle = buildCommitTitle(mergeMethodResult, prNumber, prData.title, prData.headRef);
  const commitBody = buildCommitMessage(mergeMethodResult, prData.title, actor, approvalOverridden, commits);

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
