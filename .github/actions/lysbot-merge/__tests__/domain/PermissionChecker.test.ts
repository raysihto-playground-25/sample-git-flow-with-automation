/**
 * PermissionChecker.test.ts - Tests for PermissionChecker domain service
 */

import { describe, it, expect } from 'vitest';

import { PermissionChecker } from '../../src/domain/services/PermissionChecker.js';

describe('PermissionChecker', () => {
  const checker = new PermissionChecker();

  describe('isBot', () => {
    it('should return true for Bot user type', () => {
      expect(checker.isBot('Bot')).toBe(true);
    });

    it('should return false for User type', () => {
      expect(checker.isBot('User')).toBe(false);
    });
  });

  describe('hasValidAuthorAssociation', () => {
    it('should return true for OWNER', () => {
      expect(checker.hasValidAuthorAssociation('OWNER')).toBe(true);
    });

    it('should return true for MEMBER', () => {
      expect(checker.hasValidAuthorAssociation('MEMBER')).toBe(true);
    });

    it('should return true for COLLABORATOR', () => {
      expect(checker.hasValidAuthorAssociation('COLLABORATOR')).toBe(true);
    });

    it('should return false for CONTRIBUTOR', () => {
      expect(checker.hasValidAuthorAssociation('CONTRIBUTOR')).toBe(false);
    });

    it('should return false for NONE', () => {
      expect(checker.hasValidAuthorAssociation('NONE')).toBe(false);
    });
  });

  describe('hasValidPermission', () => {
    it('should return true for admin', () => {
      expect(checker.hasValidPermission('admin')).toBe(true);
    });

    it('should return true for maintain', () => {
      expect(checker.hasValidPermission('maintain')).toBe(true);
    });

    it('should return true for write', () => {
      expect(checker.hasValidPermission('write')).toBe(true);
    });

    it('should return false for read', () => {
      expect(checker.hasValidPermission('read')).toBe(false);
    });

    it('should return false for none', () => {
      expect(checker.hasValidPermission('none')).toBe(false);
    });
  });
});
