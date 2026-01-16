import { describe, expect, it } from 'vitest';

import {
  TWEMOJI,
  buildCheckResultsMarkdown,
  buildSummaryMarkdown,
  waitBeforeRetryMs,
} from '../../../../src/modules/action/index.js';
import type { CheckResult } from '../../../../src/modules/action/internal/types.js';

describe('buildCheckResultsMarkdown', () => {
  it('should include check icon for passed checks', () => {
    const checks: CheckResult[] = [{ name: 'Test check', passed: true }];
    const markdown = buildCheckResultsMarkdown(checks);

    expect(markdown).toContain(TWEMOJI.CHECK);
    expect(markdown).toContain('Test check');
  });

  it('should include cross icon for failed checks', () => {
    const checks: CheckResult[] = [{ name: 'Test check', passed: false, details: 'reason' }];
    const markdown = buildCheckResultsMarkdown(checks);

    expect(markdown).toContain(TWEMOJI.CROSS);
    expect(markdown).toContain('Test check');
    expect(markdown).toContain('(reason)');
  });

  it('should format multiple checks correctly', () => {
    const checks: CheckResult[] = [
      { name: 'Check 1', passed: true },
      { name: 'Check 2', passed: false, details: 'failed' },
      { name: 'Check 3', passed: true },
    ];
    const markdown = buildCheckResultsMarkdown(checks);

    expect(markdown.split('\n')).toHaveLength(3);
    expect(markdown).toContain('Check 1');
    expect(markdown).toContain('Check 2');
    expect(markdown).toContain('Check 3');
  });

  it('should include warning icon for failed optional checks', () => {
    const checks: CheckResult[] = [{ name: 'Optional check', passed: false, details: 'not required', optional: true }];
    const markdown = buildCheckResultsMarkdown(checks);

    expect(markdown).toContain(TWEMOJI.WARNING);
    expect(markdown).toContain('Optional check');
    expect(markdown).toContain('(not required)');
  });

  it('should include check icon for passed optional checks', () => {
    const checks: CheckResult[] = [{ name: 'Optional check', passed: true, optional: true }];
    const markdown = buildCheckResultsMarkdown(checks);

    expect(markdown).toContain(TWEMOJI.CHECK);
    expect(markdown).toContain('Optional check');
  });

  it('should format mixed required and optional checks correctly', () => {
    const checks: CheckResult[] = [
      { name: 'Required passing', passed: true },
      { name: 'Required failing', passed: false, details: 'error' },
      { name: 'Optional passing', passed: true, optional: true },
      { name: 'Optional failing', passed: false, details: 'warning', optional: true },
    ];
    const markdown = buildCheckResultsMarkdown(checks);

    expect(markdown.split('\n')).toHaveLength(4);
    expect(markdown).toContain(TWEMOJI.CHECK);
    expect(markdown).toContain(TWEMOJI.CROSS);
    expect(markdown).toContain(TWEMOJI.WARNING);
  });
});

describe('buildSummaryMarkdown', () => {
  it('builds summary with all parameters provided', () => {
    const result = buildSummaryMarkdown('✅ Merged successfully', 123, 'testuser', 'squash');

    expect(result).toContain('## lysbot-merge Summary');
    expect(result).toContain('| **Result** | ✅ Merged successfully |');
    expect(result).toContain('| **PR** | #123 |');
    expect(result).toContain('| **Triggered by** | @testuser |');
    expect(result).toContain('| **Merge Method** | `squash` |');
  });

  it('builds summary without optional parameters', () => {
    const result = buildSummaryMarkdown('⏭️ Skipped', 456, 'anotheruser');

    expect(result).toContain('## lysbot-merge Summary');
    expect(result).toContain('| **Result** | ⏭️ Skipped |');
    expect(result).toContain('| **PR** | #456 |');
    expect(result).toContain('| **Triggered by** | @anotheruser |');
    expect(result).not.toContain('Merge Method');
  });

  it('builds summary with only mergeMethod', () => {
    const result = buildSummaryMarkdown('✅ Merged successfully', 111, 'mergeuser', 'merge');

    expect(result).toContain('| **Merge Method** | `merge` |');
  });

  it('creates valid markdown table structure', () => {
    const result = buildSummaryMarkdown('✅ Test', 1, 'user');

    expect(result).toContain('| Item | Value |');
    expect(result).toContain('|------|-------|');

    const lines = result.split('\n');
    expect(lines.length).toBeGreaterThan(3);

    const dataLines = lines.filter((line) => line.includes('**'));
    dataLines.forEach((line) => {
      expect(line).toMatch(/^\|.*\|$/);
    });
  });

  it('escapes special characters properly in result text', () => {
    const result = buildSummaryMarkdown('⚠️ Warning: <special>', 333, 'special-user_123');

    expect(result).toContain('⚠️ Warning: <special>');
    expect(result).toContain('@special-user_123');
  });

  it('handles different result emojis and text', () => {
    const testCases = ['✅ Merged successfully', '⏭️ Skipped', '❌ Failed', 'ℹ️ Already merged'];

    testCases.forEach((resultText) => {
      const result = buildSummaryMarkdown(resultText, 1, 'user');
      expect(result).toContain(`| **Result** | ${resultText} |`);
    });
  });

  it('handles different PR numbers', () => {
    const testCases = [1, 42, 999, 12345];

    testCases.forEach((prNumber) => {
      const result = buildSummaryMarkdown('✅ Test', prNumber, 'user');
      expect(result).toContain(`| **PR** | #${prNumber} |`);
    });
  });

  it('handles different actors', () => {
    const testCases = ['alice', 'bob-smith', 'user_123', 'dependabot[bot]'];

    testCases.forEach((actor) => {
      const result = buildSummaryMarkdown('✅ Test', 1, actor);
      expect(result).toContain(`| **Triggered by** | @${actor} |`);
    });
  });
});

describe('waitBeforeRetryMs', () => {
  it('should resolve after specified milliseconds', async () => {
    const start = Date.now();
    await waitBeforeRetryMs(50);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(40);
    expect(elapsed).toBeLessThan(200);
  });

  it('should resolve immediately for 0ms', async () => {
    const start = Date.now();
    await waitBeforeRetryMs(0);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(50);
  });
});
