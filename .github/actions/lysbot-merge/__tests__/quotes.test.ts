/**
 * quotes.test.ts - Unit tests for quotes module
 */

import { describe, it, expect } from 'vitest';

import { getRandomQuote, formatQuote, getFormattedRandomQuote, type Quote, type QuoteCategory } from '../src/quotes.js';

describe('quotes module', () => {
  describe('getRandomQuote', () => {
    const categories: QuoteCategory[] = ['greeting', 'success', 'checksPassed', 'checksFailed'];

    it.each(categories)('should return a quote for category: %s', (category) => {
      const quote = getRandomQuote(category);
      expect(quote).toBeDefined();
      expect(quote.text).toBeTruthy();
      expect(typeof quote.text).toBe('string');
    });

    it('should return different quotes on multiple calls (probabilistic)', () => {
      // Run multiple times to increase probability of getting different quotes
      const quotes = new Set<string>();
      for (let i = 0; i < 20; i++) {
        const quote = getRandomQuote('success');
        quotes.add(quote.text);
      }
      // With 20 iterations and multiple quotes available, we should get at least 2 different ones
      // This test may occasionally fail due to randomness, but probability is very low
      expect(quotes.size).toBeGreaterThanOrEqual(2);
    });

    it('should include series information in quotes', () => {
      const quote = getRandomQuote('greeting');
      expect(quote.series).toBeTruthy();
    });
  });

  describe('formatQuote', () => {
    it('should format quote with text only', () => {
      const quote: Quote = {
        text: 'テストメッセージ',
      };
      const formatted = formatQuote(quote);
      expect(formatted).toBe('> 💬 テストメッセージ');
    });

    it('should format quote with series', () => {
      const quote: Quote = {
        text: 'テストメッセージ',
        series: 'テストシリーズ',
      };
      const formatted = formatQuote(quote);
      expect(formatted).toContain('> 💬 テストメッセージ');
      expect(formatted).toContain('> — テストシリーズ');
    });

    it('should format quote with character and series', () => {
      const quote: Quote = {
        text: 'テストメッセージ',
        character: 'テストキャラクター',
        series: 'テストシリーズ',
      };
      const formatted = formatQuote(quote);
      expect(formatted).toContain('> 💬 テストメッセージ');
      expect(formatted).toContain('> — テストキャラクター (テストシリーズ)');
    });

    it('should use markdown blockquote format', () => {
      const quote: Quote = {
        text: 'テスト',
      };
      const formatted = formatQuote(quote);
      expect(formatted.startsWith('>')).toBe(true);
    });
  });

  describe('getFormattedRandomQuote', () => {
    const categories: QuoteCategory[] = ['greeting', 'success', 'checksPassed', 'checksFailed'];

    it.each(categories)('should return formatted quote for category: %s', (category) => {
      const formatted = getFormattedRandomQuote(category);
      expect(formatted).toBeTruthy();
      expect(formatted.startsWith('>')).toBe(true);
      expect(formatted).toContain('💬');
    });

    it('should include quote text in formatted output', () => {
      const formatted = getFormattedRandomQuote('success');
      expect(formatted.length).toBeGreaterThan(10); // Should have substantial content
    });
  });
});
