import { describe, it, expect } from 'vitest';

import { buildCommitTitle, buildCommitMessage } from '../../src/merge-logic/commit-builder.js';
import type { MergeMethodResult } from '../../src/types/index.js';

describe('buildCommitTitle', () => {
  it('builds merge commit title for merge method', () => {
    const mergeMethod: MergeMethodResult = { method: 'merge', reason: 'test' };
    const title = buildCommitTitle(mergeMethod, 123, 'feat: test PR', 'feature/test');
    expect(title).toBe('Merge pull request #123 from feature/test');
  });

  it('builds squash commit title with PR number', () => {
    const mergeMethod: MergeMethodResult = { method: 'squash', reason: 'test' };
    const title = buildCommitTitle(mergeMethod, 456, 'fix: bug fix', 'fix/bug');
    expect(title).toBe('fix: bug fix (#456)');
  });
});

describe('buildCommitMessage', () => {
  it('builds simple merge commit message', () => {
    const mergeMethod: MergeMethodResult = { method: 'merge', reason: 'test' };
    const message = buildCommitMessage(mergeMethod, 'Release v1.0.0', 'testuser', false, []);
    
    expect(message).toContain('Release v1.0.0');
    expect(message).toContain('Merged-by: lysbot-merge (on behalf of @testuser)');
    expect(message).not.toContain('EXCEPTIONAL MERGE');
  });

  it('builds merge commit message with override marker', () => {
    const mergeMethod: MergeMethodResult = { method: 'merge', reason: 'test' };
    const message = buildCommitMessage(mergeMethod, 'Release v1.0.0', 'testuser', true, []);
    
    expect(message).toContain('Release v1.0.0');
    expect(message).toContain('Merged-by: lysbot-merge (on behalf of @testuser)');
    expect(message).toContain('EXCEPTIONAL MERGE');
    expect(message).toContain('--override-approval-requirement');
  });

  it('builds squash commit message with no commits', () => {
    const mergeMethod: MergeMethodResult = { method: 'squash', reason: 'test' };
    const message = buildCommitMessage(mergeMethod, 'feat: test', 'actor', false, []);
    
    expect(message).toBe('Merged-by: lysbot-merge (on behalf of @actor)');
  });

  it('builds squash commit message with commit titles', () => {
    const mergeMethod: MergeMethodResult = { method: 'squash', reason: 'test' };
    const commits = [
      { commit: { message: 'feat: add feature' } },
      { commit: { message: 'fix: fix bug' } },
    ];
    const message = buildCommitMessage(mergeMethod, 'feat: test', 'actor', false, commits);
    
    expect(message).toContain('* feat: add feature');
    expect(message).toContain('* fix: fix bug');
    expect(message).toContain('Merged-by: lysbot-merge');
  });

  it('builds squash commit message with co-authors', () => {
    const mergeMethod: MergeMethodResult = { method: 'squash', reason: 'test' };
    const commits = [
      { commit: { message: 'feat: add feature', author: { name: 'Alice', email: 'alice@example.com' } } },
      { commit: { message: 'fix: fix bug', author: { name: 'Bob', email: 'bob@example.com' } } },
    ];
    const message = buildCommitMessage(mergeMethod, 'feat: test', 'actor', false, commits);
    
    expect(message).toContain('Co-authored-by: Alice <alice@example.com>');
    expect(message).toContain('Co-authored-by: Bob <bob@example.com>');
  });

  it('deduplicates co-authors', () => {
    const mergeMethod: MergeMethodResult = { method: 'squash', reason: 'test' };
    const commits = [
      { commit: { message: 'feat: add feature', author: { name: 'Alice', email: 'alice@example.com' } } },
      { commit: { message: 'fix: fix bug', author: { name: 'Alice', email: 'alice@example.com' } } },
    ];
    const message = buildCommitMessage(mergeMethod, 'feat: test', 'actor', false, commits);
    
    const matches = message.match(/Co-authored-by: Alice/g);
    expect(matches).toHaveLength(1);
  });

  it('filters out commits with empty messages', () => {
    const mergeMethod: MergeMethodResult = { method: 'squash', reason: 'test' };
    const commits = [
      { commit: { message: 'feat: valid' } },
      { commit: { message: '' } },
      { commit: { message: '\n\nOnly body' } },
    ];
    const message = buildCommitMessage(mergeMethod, 'feat: test', 'actor', false, commits);
    
    expect(message).toContain('* feat: valid');
    const bulletCount = (message.match(/^\*/gm) || []).length;
    expect(bulletCount).toBe(1);
  });
});
