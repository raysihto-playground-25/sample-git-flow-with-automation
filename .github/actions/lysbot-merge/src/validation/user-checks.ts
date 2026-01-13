import { VALID_AUTHOR_ASSOCIATIONS, VALID_PERMISSIONS } from '../constants/index.js';

export function isBot(userType: string): boolean {
  return userType === 'Bot';
}

export function hasValidAuthorAssociation(association: string): boolean {
  return (VALID_AUTHOR_ASSOCIATIONS as readonly string[]).includes(association);
}

export function hasValidPermission(permission: string): boolean {
  return (VALID_PERMISSIONS as readonly string[]).includes(permission);
}
