import { CHECK_ICONS } from '../domain/constants.js';
import type { ActionResult, CheckResult } from '../domain/types.js';

export function buildCheckResultsMarkdown(checks: CheckResult[]): string {
  return checks
    .map((check) => {
      let icon: string;
      if (check.passed) {
        icon = CHECK_ICONS.CHECK;
      } else if (check.optional) {
        icon = CHECK_ICONS.WARNING;
      } else {
        icon = CHECK_ICONS.CROSS;
      }
      const detail = check.details ? ` (${check.details})` : '';
      return `- ${icon} ${check.name}${detail}`;
    })
    .join('\n');
}

export function getResultMessage(status: ActionResult['status']): string {
  const resultMessages = {
    merged: '✅ Merged successfully',
    skipped: '⏭️ Skipped',
    failed: '❌ Failed',
    already_merged: 'ℹ️ Already merged',
  };
  return resultMessages[status];
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
