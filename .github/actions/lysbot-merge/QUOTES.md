# Contributing Quotes to lysbot-merge

This guide explains how to add new catchphrases and quotes to lysbot-merge.

## Quote Structure

Each quote has the following structure:

```typescript
{
  text: string;        // The quote text (required)
  character?: string;  // Character name (optional)
  series?: string;     // Series name (optional)
}
```

## Quote Categories

Quotes are organized into 4 categories based on when they appear:

### 1. `greeting`

**When**: After command validation passes, before processing begins
**Purpose**: Welcome users and create excitement
**Example**: `'ポケモンゲットだぜ！みんな、準備はいいかい？'`

### 2. `checksPassed`

**When**: When all pre-merge checks succeed
**Purpose**: Celebrate validation success
**Example**: `'きみにきめた！'`

### 3. `success`

**When**: When merge completes successfully
**Purpose**: Amplify joy of successful merge
**Example**: `'ゲットだぜ！'`

### 4. `checksFailed`

**When**: When checks fail
**Purpose**: Encourage users to try again
**Example**: `'あきらめないで！プリキュアは何度でも立ち上がる！'`

## Adding New Quotes

### Step 1: Choose the Right Category

Consider when your quote should appear and choose the appropriate category:

- **Greeting**: Enthusiastic, welcoming, ready to start
- **Checks Passed**: Confident, ready, "everything is perfect"
- **Success**: Celebratory, victorious, accomplished
- **Checks Failed**: Encouraging, supportive, "try again"

### Step 2: Edit `src/quotes.ts`

Add your quote to the appropriate category array:

```typescript
const quotes: Record<QuoteCategory, Quote[]> = {
  greeting: [
    // ... existing quotes
    { text: 'Your new quote!', character: 'Character Name', series: 'Series Name' },
  ],
  // ... other categories
};
```

### Step 3: Follow These Guidelines

**Good Quotes:**

- ✅ Are positive and encouraging
- ✅ Match the emotional tone of the moment
- ✅ Are short and memorable
- ✅ Include proper character/series attribution
- ✅ Use emojis sparingly and appropriately

**Avoid:**

- ❌ Negative or discouraging messages (except constructive encouragement in `checksFailed`)
- ❌ Overly long quotes that distract from the message
- ❌ Quotes that don't match the category's purpose
- ❌ Inappropriate or controversial content

### Step 4: Test Your Changes

```bash
# Run tests to ensure everything works
npm run check:test

# Run all quality checks
npm run all
```

### Step 5: Verify the Output

Make sure your quote:

1. Displays correctly in markdown format
2. Includes proper attribution if applicable
3. Fits well with existing quotes in the category

## Example Contributions

### Example 1: Adding a Pokémon Quote

```typescript
// In the 'success' category
{
  text: 'サイコー！最強のチームワークだ！',
  series: 'ポケモン'
}
```

**Output:**

```markdown
> 💬 サイコー！最強のチームワークだ！
>
> — ポケモン
```

### Example 2: Adding a Character-Specific Quote

```typescript
// In the 'greeting' category
{
  text: 'ポケモンゲットだぜ！みんな、準備はいいかい？',
  character: 'サトシ',
  series: 'ポケモン'
}
```

**Output:**

```markdown
> 💬 ポケモンゲットだぜ！みんな、準備はいいかい？
>
> — サトシ (ポケモン)
```

## Current Franchises

Currently supported franchises:

- **Pokémon** (ポケモン)
- **Precure** (プリキュア)
  - Various series: スマイルプリキュア, キラキラ☆プリキュアアラモード, etc.

## Adding New Franchises

Want to add quotes from other franchises? Consider:

1. **Cultural Relevance**: Is it popular and beloved?
2. **Appropriate Tone**: Does it fit lysbot-merge's positive, encouraging style?
3. **Quote Quality**: Are there memorable catchphrases to draw from?
4. **Variety**: Can you contribute multiple quotes across different categories?

Good candidates might include:

- Digimon (デジモン)
- Dragon Ball (ドラゴンボール)
- One Piece (ワンピース)
- Naruto (ナルト)
- And other popular anime/game series with memorable catchphrases

## Quote Distribution Goals

Try to maintain balanced distribution across categories:

- **Target**: 8-12 quotes per category
- **Minimum**: At least 4 quotes per category
- **Variety**: Mix of character-specific and general series quotes

## Testing Your Quotes

After adding quotes, verify:

1. **TypeScript compilation**: `npm run check:type`
2. **Linting**: `npm run check:lint`
3. **Formatting**: `npm run check:format`
4. **Tests**: `npm run check:test`
5. **Full build**: `npm run all`

All checks must pass before submitting your changes.

## Code Review Checklist

Before submitting a PR with new quotes:

- [ ] Quotes are appropriate and positive
- [ ] Attribution is correct (character/series names)
- [ ] Quotes are in the right category
- [ ] All tests pass
- [ ] Code is properly formatted
- [ ] No TypeScript errors
- [ ] Distribution across categories is reasonable

## Questions?

If you have questions about adding quotes, please:

1. Check this guide first
2. Review existing quotes in `src/quotes.ts`
3. Open an issue for discussion

---

Thank you for contributing to make lysbot-merge more fun and engaging! 🎉
