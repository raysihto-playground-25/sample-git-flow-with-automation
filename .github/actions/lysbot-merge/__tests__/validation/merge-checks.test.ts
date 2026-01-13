import { describe, it, expect } from 'vitest';

import { isConventionalCommitTitle } from '../../src/validation/merge-checks.js';

describe('isConventionalCommitTitle', () => {
  describe('valid Conventional Commits titles', () => {
    it('matches simple type: description format', () => {
      expect(isConventionalCommitTitle('feat: add new feature')).toBe(true);
      expect(isConventionalCommitTitle('fix: resolve bug')).toBe(true);
      expect(isConventionalCommitTitle('docs: update readme')).toBe(true);
    });

    it('matches type(scope): description format', () => {
      expect(isConventionalCommitTitle('feat(auth): add login')).toBe(true);
      expect(isConventionalCommitTitle('fix(api): resolve error')).toBe(true);
      expect(isConventionalCommitTitle('docs(readme): update installation')).toBe(true);
    });

    it('matches breaking changes without scope using "type!: description"', () => {
      expect(isConventionalCommitTitle('feat!: add new feature')).toBe(true);
      expect(isConventionalCommitTitle('fix!: resolve bug')).toBe(true);
      expect(isConventionalCommitTitle('docs!: update readme')).toBe(true);
    });

    it('matches breaking changes with scope using "type(scope)!: description"', () => {
      expect(isConventionalCommitTitle('feat(auth)!: add login')).toBe(true);
      expect(isConventionalCommitTitle('fix(api)!: resolve error')).toBe(true);
      expect(isConventionalCommitTitle('docs(readme)!: update installation')).toBe(true);
    });

    it('matches all 12 supported types', () => {
      const types = [
        'build',
        'chore',
        'ci',
        'docs',
        'feat',
        'fix',
        'perf',
        'refactor',
        'revert',
        'style',
        'test',
        'ux',
      ];
      for (const type of types) {
        expect(isConventionalCommitTitle(`${type}: some description`)).toBe(true);
        expect(isConventionalCommitTitle(`${type}(scope): some description`)).toBe(true);
        expect(isConventionalCommitTitle(`${type}!: some description`)).toBe(true);
        expect(isConventionalCommitTitle(`${type}(scope)!: some description`)).toBe(true);
      }
    });

    it('matches with complex scope names', () => {
      expect(isConventionalCommitTitle('feat(user-management): add feature')).toBe(true);
      expect(isConventionalCommitTitle('fix(api/v2): resolve bug')).toBe(true);
    });
  });

  describe('invalid titles', () => {
    it('rejects titles without colon', () => {
      expect(isConventionalCommitTitle('feat add new feature')).toBe(false);
    });

    it('rejects titles without type', () => {
      expect(isConventionalCommitTitle(': add new feature')).toBe(false);
      expect(isConventionalCommitTitle('Add new feature')).toBe(false);
    });

    it('rejects unsupported types', () => {
      expect(isConventionalCommitTitle('feature: add new feature')).toBe(false);
      expect(isConventionalCommitTitle('bugfix: resolve issue')).toBe(false);
      expect(isConventionalCommitTitle('update: change something')).toBe(false);
    });

    it('rejects empty description', () => {
      expect(isConventionalCommitTitle('feat:')).toBe(false);
      expect(isConventionalCommitTitle('feat: ')).toBe(false);
    });

    it('rejects empty scope', () => {
      expect(isConventionalCommitTitle('feat(): description')).toBe(false);
    });

    it('rejects when type has leading text', () => {
      expect(isConventionalCommitTitle('prefix feat: add feature')).toBe(false);
    });

    it('rejects missing colon with "!"', () => {
      expect(isConventionalCommitTitle('feat! breaking change')).toBe(false);
      expect(isConventionalCommitTitle('feat(scope)! breaking change')).toBe(false);
    });

    it('rejects misplaced "!" marker', () => {
      expect(isConventionalCommitTitle('feat !: breaking change')).toBe(false);
      expect(isConventionalCommitTitle('feat(!): breaking change')).toBe(false);
      expect(isConventionalCommitTitle('feat(scope!): breaking change')).toBe(false);
      expect(isConventionalCommitTitle('feat(scope)! : breaking change')).toBe(false);
    });
  });
});
