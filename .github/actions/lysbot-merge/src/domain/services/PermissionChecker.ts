/**
 * PermissionChecker.ts - Domain service for permission validation
 *
 * This service validates user permissions for merge operations.
 */

/**
 * Valid author associations that can use merge commands.
 * Why: Only trusted users with write access should be able to trigger merges.
 */
const VALID_AUTHOR_ASSOCIATIONS = ['OWNER', 'MEMBER', 'COLLABORATOR'] as const;

/**
 * Valid permission levels that can use merge commands.
 * Why: Maps to GitHub's permission model - admin/maintain/write can merge PRs.
 */
const VALID_PERMISSIONS = ['admin', 'maintain', 'write'] as const;

/**
 * Domain service for checking user permissions.
 */
export class PermissionChecker {
  /**
   * Checks if a user type indicates a bot.
   *
   * @param userType - The type of user
   * @returns true if the user is a bot
   */
  isBot(userType: string): boolean {
    return userType === 'Bot';
  }

  /**
   * Checks if the author association is valid for using merge commands.
   *
   * @param association - The author_association from GitHub
   * @returns true if the association allows merge command usage
   */
  hasValidAuthorAssociation(association: string): boolean {
    return (VALID_AUTHOR_ASSOCIATIONS as readonly string[]).includes(association);
  }

  /**
   * Checks if the permission level allows merge command usage.
   *
   * @param permission - The permission level from GitHub
   * @returns true if the permission level is sufficient
   */
  hasValidPermission(permission: string): boolean {
    return (VALID_PERMISSIONS as readonly string[]).includes(permission);
  }
}
