import type { CommitInfo } from '../../common/types.js';

/**
 * Service for building commit messages for merge operations.
 * Contains reusable logic for formatting commit titles and messages.
 */
export class MergeCommitService {
  /**
   * Builds the base additional messages for commit message.
   */
  private buildAdditionalMessages(actor: string, approvalOverridden: boolean): string {
    let message = `Merged-by: lysbot-merge (on behalf of @${actor})`;
    if (approvalOverridden) {
      message += `\n\n⚠️ EXCEPTIONAL MERGE: Approval requirement overridden via --override-approval-requirement`;
    }
    return message;
  }

  /**
   * Builds commit title and message for a merge commit.
   */
  buildMergeCommitMessage(
    prNumber: number,
    prTitle: string,
    headRef: string,
    actor: string,
    approvalOverridden: boolean,
  ): { commitTitle: string; commitMessage: string } {
    const commitTitle = `Merge pull request #${prNumber} from ${headRef}`;
    const additionalMessages = this.buildAdditionalMessages(actor, approvalOverridden);
    const commitMessage = `${prTitle}\n\n${additionalMessages}`;
    return { commitTitle, commitMessage };
  }

  /**
   * Builds commit title and message for a squash commit.
   */
  buildSquashCommitMessage(
    prNumber: number,
    prTitle: string,
    commits: CommitInfo[],
    actor: string,
    approvalOverridden: boolean,
  ): { commitTitle: string; commitMessage: string } {
    const commitTitle = `${prTitle} (#${prNumber})`;

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

    const additionalMessages = this.buildAdditionalMessages(actor, approvalOverridden);
    bodyParts.push(additionalMessages);

    const commitMessage = bodyParts.join('\n\n');
    return { commitTitle, commitMessage };
  }
}
