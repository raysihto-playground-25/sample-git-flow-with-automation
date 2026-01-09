/**
 * SummaryPresenter.ts - Presenter for building summary markdown
 *
 * This presenter formats the merge result into a summary table.
 */

/**
 * Presenter for building summary markdown.
 */
export class SummaryPresenter {
  /**
   * Builds a summary markdown table for the merge operation.
   *
   * @param result - Result status emoji and message
   * @param prNumber - PR number
   * @param actor - User who triggered the action
   * @param mergeMethod - Optional merge method used
   * @returns Markdown string for the summary
   */
  buildSummaryMarkdown(result: string, prNumber: number, actor: string, mergeMethod?: string): string {
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
}
