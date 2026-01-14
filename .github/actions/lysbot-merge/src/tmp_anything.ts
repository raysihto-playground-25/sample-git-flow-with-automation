import * as core from '@actions/core';
import type { GitHub } from '@actions/github/lib/utils.js';
import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';

export interface ActionConfig {
  releaseBranchPrefix: string;
  developBranch: string;
  syncBranchPrefix: string;
  mergeableRetryCount: number;
  mergeableRetryInterval: number;
}

export interface EventContext {
  owner: string;
  repo: string;
  prNumber: number;
  commentId: number;
  commentBody: string;
  actor: string;
  userType: string;
  authorAssociation: string;
  serverUrl: string;
  runId: number;
  eventName: string;
  isPullRequest: boolean;
}

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

export interface CheckResult {
  name: string;
  passed: boolean;
  details?: string;
  optional?: boolean;
}

export interface MergeMethodResult {
  method: 'squash' | 'merge';
  reason: string;
}

export interface ActionResult {
  status: 'merged' | 'skipped' | 'failed' | 'already_merged';
  message: string;
  mergeMethod?: 'squash' | 'merge';
}

export interface MergeOptions {
  overrideApprovalRequirement: boolean;
}

export type Octokit = InstanceType<typeof GitHub>;

export type Review = RestEndpointMethodTypes['pulls']['listReviews']['response']['data'][number];
export type ReviewsArray = RestEndpointMethodTypes['pulls']['listReviews']['response']['data'];

export const COMMAND_REGEX = /^\s*\/lysbot\s+merge(?:\s+(.*))?\s*$/;

export const VALID_FLAGS = ['--override-approval-requirement'] as const;

export const TWEMOJI = {
  CHECK:
    '<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/2705.svg" width="20" height="20" alt="OK">',
  CROSS:
    '<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/274c.svg" width="20" height="20" alt="NG">',
  WARNING:
    '<img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/26a0.svg" width="20" height="20" alt="Warning">',
} as const;

export const VALID_AUTHOR_ASSOCIATIONS = ['OWNER', 'MEMBER', 'COLLABORATOR'] as const;

export const VALID_PERMISSIONS = ['admin', 'maintain', 'write'] as const;

export const CONVENTIONAL_COMMIT_TYPES = [
  'build',
  'chore',
  'ci',
  'docs',
  'feat',
  'fix',
  'perf',
  'refactor',
  'revert',
  'style',
  'test',
  'ux',
] as const;

export const CONVENTIONAL_COMMIT_REGEX = new RegExp(
  `^(${CONVENTIONAL_COMMIT_TYPES.join('|')})(\\([^)!]+\\))?!?:\\s*\\S.*$`,
);

export async function addReaction(
  octokit: Octokit,
  owner: string,
  repo: string,
  commentId: number,
  reaction: '+1' | '-1' | 'laugh' | 'confused' | 'heart' | 'hooray' | 'rocket' | 'eyes',
): Promise<void> {
  try {
    await octokit.rest.reactions.createForIssueComment({
      owner,
      repo,
      comment_id: commentId,
      content: reaction,
    });
  } catch {
    /* */
  }
}

export async function postComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  body: string,
): Promise<void> {
  await octokit.rest.issues.createComment({
    owner,
    repo,
    issue_number: prNumber,
    body,
  });
}

export async function getCollaboratorPermission(
  octokit: Octokit,
  owner: string,
  repo: string,
  username: string,
): Promise<string> {
  try {
    const response = await octokit.rest.repos.getCollaboratorPermissionLevel({
      owner,
      repo,
      username,
    });
    return response.data.permission;
  } catch {
    return 'none';
  }
}

export async function fetchPullRequestData(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<PullRequestData> {
  const response = await octokit.rest.pulls.get({
    owner,
    repo,
    pull_number: prNumber,
  });
  const pr = response.data;

  const isFork = pr.head.repo?.fork === true || pr.head.repo?.owner?.id !== pr.base.repo?.owner?.id;

  return {
    state: pr.state,
    locked: pr.locked,
    draft: pr.draft ?? false,
    merged: pr.merged,
    mergeable: pr.mergeable,
    mergeableState: pr.mergeable_state,
    headSha: pr.head.sha,
    headRef: pr.head.ref,
    baseRef: pr.base.ref,
    author: pr.user?.login ?? 'unknown',
    isFork,
    title: pr.title,
  };
}

export async function fetchApprovedReviews(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<ReviewsArray> {
  const reviews = await octokit.paginate(octokit.rest.pulls.listReviews, {
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });
  return reviews.filter((review) => review.state === 'APPROVED');
}

export async function dismissReview(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  reviewId: number,
  message: string,
): Promise<boolean> {
  try {
    await octokit.rest.pulls.dismissReview({
      owner,
      repo,
      pull_number: prNumber,
      review_id: reviewId,
      message,
    });
    return true;
  } catch {
    return false;
  }
}

export async function countUnresolvedThreads(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<number> {
  let unresolvedCount = 0;
  let hasNextPage = true;
  let cursor: string | null = null;

  const query = `
    query($owner: String!, $name: String!, $number: Int!, $cursor: String) {
      repository(owner: $owner, name: $name) {
        pullRequest(number: $number) {
          reviewThreads(first: 100, after: $cursor) {
            pageInfo {
              hasNextPage
              endCursor
            }
            nodes {
              isResolved
            }
          }
        }
      }
    }
  `;

  while (hasNextPage) {
    const response: {
      repository: {
        pullRequest: {
          reviewThreads: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: Array<{ isResolved: boolean }>;
          };
        };
      };
    } = await octokit.graphql(query, {
      owner,
      name: repo,
      number: prNumber,
      cursor,
    });

    const threads = response.repository.pullRequest.reviewThreads;
    unresolvedCount += threads.nodes.filter((n) => !n.isResolved).length;
    hasNextPage = threads.pageInfo.hasNextPage;
    cursor = threads.pageInfo.endCursor;
  }

  return unresolvedCount;
}

export async function fetchPullRequestCommits(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<Array<{ commit: { message: string; author?: { name?: string; email?: string } | null } }>> {
  const commits = await octokit.paginate(octokit.rest.pulls.listCommits, {
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  });
  return commits;
}

export async function mergePullRequest(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number,
  method: 'squash' | 'merge',
  sha: string,
  commitTitle: string,
  commitMessage: string,
): Promise<{ success: boolean; error?: string; mergeCommitSha?: string }> {
  try {
    const response = await octokit.rest.pulls.merge({
      owner,
      repo,
      pull_number: prNumber,
      merge_method: method,
      sha,
      commit_title: commitTitle,
      commit_message: commitMessage,
    });
    return { success: true, mergeCommitSha: response.data.sha };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

export function isConventionalCommitTitle(title: string): boolean {
  return CONVENTIONAL_COMMIT_REGEX.test(title);
}

export function parseCommand(commentBody: string): MergeOptions | null {
  const match = COMMAND_REGEX.exec(commentBody);
  if (!match) {
    return null;
  }

  const flagsStr = match[1]?.trim() ?? '';
  const flags = flagsStr ? flagsStr.split(/\s+/) : [];

  const validFlagsArray: readonly string[] = VALID_FLAGS;
  if (!flags.every((flag) => validFlagsArray.includes(flag))) {
    return null;
  }

  return {
    overrideApprovalRequirement: flags.includes('--override-approval-requirement'),
  };
}

export function isCommand(commentBody: string): boolean {
  return parseCommand(commentBody) !== null;
}

export function isBot(userType: string): boolean {
  return userType === 'Bot';
}

export function hasValidAuthorAssociation(association: string): boolean {
  return (VALID_AUTHOR_ASSOCIATIONS as readonly string[]).includes(association);
}

export function hasValidPermission(permission: string): boolean {
  return (VALID_PERMISSIONS as readonly string[]).includes(permission);
}

export function determineMergeMethod(headRef: string, baseRef: string, config: ActionConfig): MergeMethodResult {
  if (headRef.startsWith(config.releaseBranchPrefix)) {
    return {
      method: 'merge',
      reason: `Head branch \`${headRef}\` is a release branch (merge commit to preserve release history)`,
    };
  }
  if (headRef.startsWith(config.syncBranchPrefix)) {
    return {
      method: 'merge',
      reason: `Head branch \`${headRef}\` is a sync branch (merge commit to preserve back-merge history)`,
    };
  }

  if (baseRef.startsWith(config.releaseBranchPrefix)) {
    return {
      method: 'squash',
      reason: `Base branch \`${baseRef}\` is a release branch`,
    };
  }
  if (baseRef === config.developBranch) {
    return {
      method: 'squash',
      reason: `Base branch is \`${baseRef}\``,
    };
  }

  return {
    method: 'merge',
    reason: `Default merge commit for \`${headRef}\` into \`${baseRef}\``,
  };
}

export function validatePRState(prData: PullRequestData): CheckResult[] {
  const checks: CheckResult[] = [];

  const isOpen = prData.state === 'open';
  const isUnlocked = !prData.locked;
  const isNotDraft = !prData.draft;
  const allPassed = isOpen && isUnlocked && isNotDraft;

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

export function getMergeableStateDescription(state: string): string {
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

export function buildCheckResultsMarkdown(checks: CheckResult[]): string {
  return checks
    .map((check) => {
      let icon: string;
      if (check.passed) {
        icon = TWEMOJI.CHECK;
      } else if (check.optional) {
        icon = TWEMOJI.WARNING;
      } else {
        icon = TWEMOJI.CROSS;
      }
      const detail = check.details ? ` (${check.details})` : '';
      return `- ${icon} ${check.name}${detail}`;
    })
    .join('\n');
}

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

  let commitTitle: string;
  let commitBody: string;

  let additionalMessages = `Merged-by: lysbot-merge (on behalf of @${actor})`;
  if (approvalOverridden) {
    additionalMessages += `\n\n⚠️ EXCEPTIONAL MERGE: Approval requirement overridden via --override-approval-requirement`;
  }

  if (mergeMethodResult.method === 'merge') {
    commitTitle = `Merge pull request #${prNumber} from ${prData.headRef}`;
    commitBody = `${prData.title}\n\n${additionalMessages}`;
  } else {
    commitTitle = `${prData.title} (#${prNumber})`;

    const commits = await fetchPullRequestCommits(octokit, owner, repo, prNumber);
    const commitTitles = commits
      .map((c) => {
        const message = c.commit.message || '';
        const firstLine = message.split('\n')[0];
        return firstLine ? `* ${firstLine}` : '';
      })
      .filter((title) => title !== '');

    const coAuthors: string[] = [];
    commits.forEach((c) => {
      const author = c.commit.author;
      if (author?.name && author?.email) {
        const authorLine = `Co-authored-by: ${author.name} <${author.email}>`;
        if (!coAuthors.includes(authorLine)) {
          coAuthors.push(authorLine);
        }
      }
    });

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

export function buildSummaryMarkdown(result: string, prNumber: number, actor: string, mergeMethod?: string): string {
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
