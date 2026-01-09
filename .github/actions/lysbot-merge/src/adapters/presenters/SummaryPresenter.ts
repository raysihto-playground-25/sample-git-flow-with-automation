/**
 * SummaryPresenter - Presenter for building summary markdown
 *
 * This presenter handles the formatting of the action summary
 * that appears in the GitHub Actions UI.
 */

export class SummaryPresenter {
  /**
   * Builds a summary markdown table for the lysbot-merge operation.
   *
   * @param result - Result status emoji and message
   * @param prNumber - PR number
   * @param actor - User who triggered the action
   * @param mergeMethod - Optional merge method used
   * @returns Markdown string for the summary
   */
  buildSummary(result: string, prNumber: number, actor: string, mergeMethod?: string): string {
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
