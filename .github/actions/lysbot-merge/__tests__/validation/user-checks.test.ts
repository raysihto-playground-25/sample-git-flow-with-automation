import { describe, it, expect } from 'vitest';

import { isBot, hasValidAuthorAssociation, hasValidPermission } from '../../src/validation/user-checks.js';

describe('isBot', () => {
  it('should return true for Bot user type', () => {
    expect(isBot('Bot')).toBe(true);
  });

  it('should return false for User type', () => {
    expect(isBot('User')).toBe(false);
  });

  it('should return false for other types', () => {
    expect(isBot('Organization')).toBe(false);
    expect(isBot('Mannequin')).toBe(false);
    expect(isBot('')).toBe(false);
  });
});

describe('hasValidAuthorAssociation', () => {
  describe('allowed associations (can use /lysbot merge)', () => {
    it('allows OWNER (repository/org owner)', () => {
      expect(hasValidAuthorAssociation('OWNER')).toBe(true);
    });

    it('allows MEMBER (organization member)', () => {
      expect(hasValidAuthorAssociation('MEMBER')).toBe(true);
    });

    it('allows COLLABORATOR (explicit repo access)', () => {
      expect(hasValidAuthorAssociation('COLLABORATOR')).toBe(true);
    });
  });

  describe('rejected associations', () => {
    it('rejects CONTRIBUTOR (PR author without collaborator status)', () => {
      expect(hasValidAuthorAssociation('CONTRIBUTOR')).toBe(false);
    });

    it('rejects FIRST_TIME_CONTRIBUTOR', () => {
      expect(hasValidAuthorAssociation('FIRST_TIME_CONTRIBUTOR')).toBe(false);
    });

    it('rejects FIRST_TIMER', () => {
      expect(hasValidAuthorAssociation('FIRST_TIMER')).toBe(false);
    });

    it('rejects NONE (no association)', () => {
      expect(hasValidAuthorAssociation('NONE')).toBe(false);
    });
  });
});

describe('hasValidPermission', () => {
  describe('allowed permissions (can use /lysbot merge)', () => {
    it('allows admin permission', () => {
      expect(hasValidPermission('admin')).toBe(true);
    });

    it('allows maintain permission', () => {
      expect(hasValidPermission('maintain')).toBe(true);
    });

    it('allows write permission', () => {
      expect(hasValidPermission('write')).toBe(true);
    });
  });

  describe('rejected permissions', () => {
    it('rejects read permission', () => {
      expect(hasValidPermission('read')).toBe(false);
    });

    it('rejects none (no permission)', () => {
      expect(hasValidPermission('none')).toBe(false);
    });
  });
});
