/**
 * action.test.ts - Tests for action.ts module
 *
 * Tests the buildSummaryMarkdown function which builds markdown summaries.
 */

import { describe, it, expect } from 'vitest';
import { buildSummaryMarkdown } from './action';

describe('buildSummaryMarkdown', () => {
  it('builds summary with all parameters provided', () => {
    const result = buildSummaryMarkdown(
      '✅ Merged successfully',
      123,
      'testuser',
      'feature/test',
      'develop',
      'squash',
      'abc1234567890',
    );

    expect(result).toContain('## lysbot-merge Summary');
    expect(result).toContain('| **Result** | ✅ Merged successfully |');
    expect(result).toContain('| **PR** | #123 |');
    expect(result).toContain('| **Triggered by** | @testuser |');
    expect(result).toContain('| **Head Branch** | `feature/test` |');
    expect(result).toContain('| **Base Branch** | `develop` |');
    expect(result).toContain('| **Merge Method** | `squash` |');
    expect(result).toContain('| **HEAD SHA** | abc1234567890 |');
  });

  it('builds summary without optional parameters', () => {
    const result = buildSummaryMarkdown('⏭️ Skipped', 456, 'anotheruser');

    expect(result).toContain('## lysbot-merge Summary');
    expect(result).toContain('| **Result** | ⏭️ Skipped |');
    expect(result).toContain('| **PR** | #456 |');
    expect(result).toContain('| **Triggered by** | @anotheruser |');
    expect(result).not.toContain('Head Branch');
    expect(result).not.toContain('Base Branch');
    expect(result).not.toContain('Merge Method');
    expect(result).not.toContain('HEAD SHA');
  });

  it('builds summary with only headRef and baseRef', () => {
    const result = buildSummaryMarkdown('❌ Failed', 789, 'failuser', 'feature/fail', 'main', undefined, undefined);

    expect(result).toContain('| **Head Branch** | `feature/fail` |');
    expect(result).toContain('| **Base Branch** | `main` |');
    expect(result).not.toContain('Merge Method');
    expect(result).not.toContain('HEAD SHA');
  });

  it('builds summary with only mergeMethod', () => {
    const result = buildSummaryMarkdown(
      '✅ Merged successfully',
      111,
      'mergeuser',
      undefined,
      undefined,
      'merge',
      undefined,
    );

    expect(result).toContain('| **Merge Method** | `merge` |');
    expect(result).not.toContain('Head Branch');
    expect(result).not.toContain('Base Branch');
    expect(result).not.toContain('HEAD SHA');
  });

  it('builds summary with only headSha', () => {
    const result = buildSummaryMarkdown(
      'ℹ️ Already merged',
      222,
      'shauser',
      undefined,
      undefined,
      undefined,
      'def9876543210',
    );

    expect(result).toContain('| **HEAD SHA** | def9876543210 |');
    expect(result).not.toContain('Head Branch');
    expect(result).not.toContain('Base Branch');
    expect(result).not.toContain('Merge Method');
  });

  it('creates valid markdown table structure', () => {
    const result = buildSummaryMarkdown('✅ Test', 1, 'user');

    // Check for markdown table headers
    expect(result).toContain('| Item | Value |');
    expect(result).toContain('|------|-------|');

    // Should have proper line breaks
    const lines = result.split('\n');
    expect(lines.length).toBeGreaterThan(3);

    // Each data row should have pipe delimiters
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

  it('includes branches only when both headRef and baseRef are provided', () => {
    // Both provided
    let result = buildSummaryMarkdown('✅ Test', 1, 'user', 'head', 'base');
    expect(result).toContain('Head Branch');
    expect(result).toContain('Base Branch');

    // Only headRef provided
    result = buildSummaryMarkdown('✅ Test', 1, 'user', 'head', undefined);
    expect(result).not.toContain('Head Branch');
    expect(result).not.toContain('Base Branch');

    // Only baseRef provided
    result = buildSummaryMarkdown('✅ Test', 1, 'user', undefined, 'base');
    expect(result).not.toContain('Head Branch');
    expect(result).not.toContain('Base Branch');

    // Neither provided
    result = buildSummaryMarkdown('✅ Test', 1, 'user');
    expect(result).not.toContain('Head Branch');
    expect(result).not.toContain('Base Branch');
  });
});
