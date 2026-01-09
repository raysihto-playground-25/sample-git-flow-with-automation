/**
 * presenter.test.ts - Tests for SummaryPresenter
 *
 * Tests cover the summary markdown generation.
 */

import { describe, it, expect } from 'vitest';

import { SummaryPresenter } from '../src/adapters/presenters/SummaryPresenter.js';

describe('SummaryPresenter', () => {
  describe('buildSummary', () => {
    it('should build summary with all fields', () => {
      const presenter = new SummaryPresenter();

      const summary = presenter.buildSummary('✅ Success', 123, 'testuser', 'squash');

      expect(summary).toContain('## lysbot-merge Summary');
      expect(summary).toContain('✅ Success');
      expect(summary).toContain('#123');
      expect(summary).toContain('@testuser');
      expect(summary).toContain('squash');
    });

    it('should build summary without merge method', () => {
      const presenter = new SummaryPresenter();

      const summary = presenter.buildSummary('⏭️ Skipped', 456, 'anotheruser');

      expect(summary).toContain('## lysbot-merge Summary');
      expect(summary).toContain('⏭️ Skipped');
      expect(summary).toContain('#456');
      expect(summary).toContain('@anotheruser');
      expect(summary).not.toContain('squash');
      expect(summary).not.toContain('`merge`'); // Changed: check for literal merge method value, not the word "merge" in headers
    });

    it('should format as markdown table', () => {
      const presenter = new SummaryPresenter();

      const summary = presenter.buildSummary('❌ Failed', 789, 'user3', 'merge');

      expect(summary).toContain('| Item | Value |');
      expect(summary).toContain('|------|-------|');
      expect(summary).toContain('| **Result** |');
      expect(summary).toContain('| **PR** |');
      expect(summary).toContain('| **Triggered by** |');
      expect(summary).toContain('| **Merge Method** |');
    });
  });
});
