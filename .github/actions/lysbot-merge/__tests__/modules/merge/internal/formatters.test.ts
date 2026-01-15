import { describe, expect, it } from 'vitest';

import {
  buildCheckResultsMarkdown,
  buildSummaryMarkdown,
  waitBeforeRetryMs,
} from '../../../../src/modules/merge/internal/formatters.js';
import type { CheckResult } from '../../../../src/modules/merge/internal/types.js';

describe('formatters', () => {
  describe('buildCheckResultsMarkdown', () => {
    it('should format passed checks with check icon', () => {
      const checks: CheckResult[] = [{ name: 'Test check', passed: true }];
      const markdown = buildCheckResultsMarkdown(checks);
      expect(markdown).toContain('Test check');
      expect(markdown).toContain('2705.svg'); // Check mark emoji
    });

    it('should format failed checks with cross icon', () => {
      const checks: CheckResult[] = [{ name: 'Test check', passed: false }];
      const markdown = buildCheckResultsMarkdown(checks);
      expect(markdown).toContain('Test check');
      expect(markdown).toContain('274c.svg'); // Cross mark emoji
    });

    it('should format optional failed checks with warning icon', () => {
      const checks: CheckResult[] = [{ name: 'Test check', passed: false, optional: true }];
      const markdown = buildCheckResultsMarkdown(checks);
      expect(markdown).toContain('Test check');
      expect(markdown).toContain('26a0.svg'); // Warning emoji
    });

    it('should include details in parentheses', () => {
      const checks: CheckResult[] = [{ name: 'Test check', passed: false, details: 'Some details' }];
      const markdown = buildCheckResultsMarkdown(checks);
      expect(markdown).toContain('Test check');
      expect(markdown).toContain('(Some details)');
    });

    it('should format multiple checks', () => {
      const checks: CheckResult[] = [
        { name: 'Check 1', passed: true },
        { name: 'Check 2', passed: false, details: 'Failed reason' },
        { name: 'Check 3', passed: false, optional: true },
      ];
      const markdown = buildCheckResultsMarkdown(checks);
      expect(markdown).toContain('Check 1');
      expect(markdown).toContain('Check 2');
      expect(markdown).toContain('Check 3');
      expect(markdown).toContain('Failed reason');
    });
  });

  describe('buildSummaryMarkdown', () => {
    it('should build summary with all fields', () => {
      const summary = buildSummaryMarkdown('✅ Success', 123, 'testuser', 'squash');
      expect(summary).toContain('lysbot-merge Summary');
      expect(summary).toContain('✅ Success');
      expect(summary).toContain('#123');
      expect(summary).toContain('@testuser');
      expect(summary).toContain('squash');
    });

    it('should build summary without merge method', () => {
      const summary = buildSummaryMarkdown('⏭️ Skipped', 456, 'anotheruser');
      expect(summary).toContain('lysbot-merge Summary');
      expect(summary).toContain('⏭️ Skipped');
      expect(summary).toContain('#456');
      expect(summary).toContain('@anotheruser');
      expect(summary).not.toContain('Merge Method');
    });

    it('should format as table', () => {
      const summary = buildSummaryMarkdown('✅ Success', 123, 'testuser', 'merge');
      expect(summary).toContain('| Item | Value |');
      expect(summary).toContain('|------|-------|');
    });
  });

  describe('waitBeforeRetryMs', () => {
    it('should wait for specified milliseconds', async () => {
      const start = Date.now();
      await waitBeforeRetryMs(50);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(45); // Allow some tolerance
      expect(elapsed).toBeLessThan(100);
    });

    it('should resolve promise', async () => {
      const result = await waitBeforeRetryMs(10);
      expect(result).toBeUndefined();
    });
  });
});
