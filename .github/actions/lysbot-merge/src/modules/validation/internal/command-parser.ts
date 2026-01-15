import type { PullRequestData } from '../../github/index.js';
import type { ActionConfig, MergeOptions } from '../../config/index.js';
import { COMMAND_REGEX, VALID_FLAGS, VALID_AUTHOR_ASSOCIATIONS, VALID_PERMISSIONS } from '../../config/index.js';
import type { CheckResult } from './types.js';

export interface CommandParser {
  parseCommand(commentBody: string): MergeOptions | null;
  isBot(userType: string): boolean;
  hasValidAuthorAssociation(association: string): boolean;
  hasValidPermission(permission: string): boolean;
}

export class DefaultCommandParser implements CommandParser {
  parseCommand(commentBody: string): MergeOptions | null {
    const match = COMMAND_REGEX.exec(commentBody);
    if (!match) {
      return null;
    }

    const flagsStr = match[1]?.trim() ?? '';
    const flags = flagsStr ? flagsStr.split(/\s+/) : [];

    const validFlagsArray: readonly string[] = VALID_FLAGS;
    if (!flags.every((flag) => validFlagsArray.includes(flag))) {
      return null;
    }

    return {
      overrideApprovalRequirement: flags.includes('--override-approval-requirement'),
    };
  }

  isBot(userType: string): boolean {
    return userType === 'Bot';
  }

  hasValidAuthorAssociation(association: string): boolean {
    return (VALID_AUTHOR_ASSOCIATIONS as readonly string[]).includes(association);
  }

  hasValidPermission(permission: string): boolean {
    return (VALID_PERMISSIONS as readonly string[]).includes(permission);
  }
}
