/**
 * SummaryPresenter.test.ts - Tests for SummaryPresenter adapter
 */

import { describe, it, expect } from 'vitest';

import { SummaryPresenter } from '../../src/adapters/presenters/SummaryPresenter.js';

describe('SummaryPresenter', () => {
  const presenter = new SummaryPresenter();

  describe('buildSummaryMarkdown', () => {
    it('should build summary without merge method', () => {
      const result = presenter.buildSummaryMarkdown('✅ Merged', 123, 'testuser');
      expect(result).toContain('lysbot-merge Summary');
      expect(result).toContain('✅ Merged');
      expect(result).toContain('#123');
      expect(result).toContain('@testuser');
      expect(result).not.toContain('Merge Method');
    });

    it('should build summary with merge method', () => {
      const result = presenter.buildSummaryMarkdown('✅ Merged', 123, 'testuser', 'squash');
      expect(result).toContain('lysbot-merge Summary');
      expect(result).toContain('✅ Merged');
      expect(result).toContain('#123');
      expect(result).toContain('@testuser');
      expect(result).toContain('Merge Method');
      expect(result).toContain('squash');
    });

    it('should format as markdown table', () => {
      const result = presenter.buildSummaryMarkdown('⏭️ Skipped', 456, 'reviewer');
      expect(result).toMatch(/\| Item \| Value \|/);
      expect(result).toMatch(/\|------|-------|/);
    });
  });
});
