import type { MergeMethodResult } from '../types/index.js';

export function buildCommitTitle(
  mergeMethod: MergeMethodResult,
  prNumber: number,
  prTitle: string,
  headRef: string,
): string {
  if (mergeMethod.method === 'merge') {
    return `Merge pull request #${prNumber} from ${headRef}`;
  } else {
    return `${prTitle} (#${prNumber})`;
  }
}

export function buildCommitMessage(
  mergeMethod: MergeMethodResult,
  prTitle: string,
  actor: string,
  approvalOverridden: boolean,
  commits: Array<{ commit: { message: string; author?: { name?: string; email?: string } | null } }>,
): string {
  let additionalMessages = `Merged-by: lysbot-merge (on behalf of @${actor})`;
  if (approvalOverridden) {
    additionalMessages += `\n\n⚠️ EXCEPTIONAL MERGE: Approval requirement overridden via --override-approval-requirement`;
  }

  if (mergeMethod.method === 'merge') {
    return `${prTitle}\n\n${additionalMessages}`;
  } else {
    // Squash merge
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

    return bodyParts.join('\n\n');
  }
}
