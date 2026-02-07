/**
 * quotes.ts - Fun catchphrases and quotes module for lysbot-merge
 *
 * This module provides engaging messages inspired by popular Japanese franchises
 * like Pokémon and Precure to create excitement and happiness for users.
 *
 * Categories:
 * - greeting: When bot recognizes the command
 * - success: When merge succeeds
 * - checksPassed: When all checks pass before merging
 * - checksFailed: When checks fail (encouraging retry)
 */

/**
 * Quote type definition
 */
export interface Quote {
  text: string;
  character?: string;
  series?: string;
}

/**
 * Quote categories
 */
export type QuoteCategory = 'greeting' | 'success' | 'checksPassed' | 'checksFailed';

/**
 * Collection of quotes organized by category
 */
const quotes: Record<QuoteCategory, Quote[]> = {
  greeting: [
    { text: 'ポケモンゲットだぜ！みんな、準備はいいかい？', character: 'サトシ', series: 'ポケモン' },
    { text: 'わくわくもんだぁ！', character: 'オーキド博士', series: 'ポケモン' },
    { text: 'プリキュア、がんばります！', series: 'プリキュア' },
    { text: 'ピカピカー！⚡', character: 'ピカチュウ', series: 'ポケモン' },
  ],
  checksPassed: [
    { text: 'きみにきめた！', character: 'サトシ', series: 'ポケモン' },
    { text: 'やったー！バッチリだね！', series: 'ポケモン' },
    { text: 'プリキュア・スマイルチャージ！', series: 'スマイルプリキュア' },
    { text: 'みんなの力を合わせて、レッツゴー！', series: 'プリキュア' },
    { text: '100点満点！', series: 'ポケモン' },
  ],
  success: [
    { text: 'やったね！ポケモンマスターに一歩近づいたよ！', series: 'ポケモン' },
    { text: 'ゲットだぜ！', character: 'サトシ', series: 'ポケモン' },
    { text: 'みんな、最高だよ！✨', series: 'プリキュア' },
    { text: 'キラキラ☆プリキュアアラモード！マージ完了！', series: 'キラキラ☆プリキュアアラモード' },
    { text: 'すごいぞ！まさにポケモントレーナーの鑑だね！', series: 'ポケモン' },
    { text: 'にこにこピース！✌️', series: 'プリキュア' },
  ],
  checksFailed: [
    { text: 'まだまだトレーニングが必要だね！次は頑張ろう！', series: 'ポケモン' },
    { text: 'あきらめないで！プリキュアは何度でも立ち上がる！', series: 'プリキュア' },
    { text: 'ポケモンバトルは諦めたら終わり。もう一度挑戦だ！', series: 'ポケモン' },
    { text: '次はきっと上手くいくよ！', series: 'ポケモン' },
    { text: '大丈夫！みんなで力を合わせれば、きっとできるよ！', series: 'プリキュア' },
  ],
};

/**
 * Get a random quote from the specified category
 *
 * @param category - Quote category
 * @returns Random quote from the category
 */
export function getRandomQuote(category: QuoteCategory): Quote {
  const categoryQuotes = quotes[category];
  const randomIndex = Math.floor(Math.random() * categoryQuotes.length);

  return categoryQuotes[randomIndex]!;
}

/**
 * Format a quote for display in markdown
 *
 * @param quote - Quote to format
 * @returns Formatted markdown string
 */
export function formatQuote(quote: Quote): string {
  let formatted = `> 💬 ${quote.text}`;

  if (quote.character && quote.series) {
    formatted += `\n>\n> — ${quote.character} (${quote.series})`;
  } else if (quote.series) {
    formatted += `\n>\n> — ${quote.series}`;
  }

  return formatted;
}

/**
 * Get a formatted random quote for a category
 *
 * @param category - Quote category
 * @returns Formatted markdown string with a random quote
 */
export function getFormattedRandomQuote(category: QuoteCategory): string {
  const quote = getRandomQuote(category);
  return formatQuote(quote);
}
