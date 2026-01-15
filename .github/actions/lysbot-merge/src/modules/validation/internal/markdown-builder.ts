import { TWEMOJI } from '../../config/index.js';

import type { CheckResult } from './types.js';

export interface MarkdownBuilder {
  buildCheckResultsMarkdown(checks: CheckResult[]): string;
  buildSummaryMarkdown(result: string, prNumber: number, actor: string, mergeMethod?: string): string;
}

export class DefaultMarkdownBuilder implements MarkdownBuilder {
  buildCheckResultsMarkdown(checks: CheckResult[]): string {
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
