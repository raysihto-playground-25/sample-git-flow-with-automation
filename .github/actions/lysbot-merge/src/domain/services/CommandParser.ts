/**
 * CommandParser.ts - Domain service for parsing merge commands
 *
 * This service parses and validates merge commands.
 */

import type { MergeCommand } from '../entities/MergeCommand.js';

/**
 * List of valid command flags for merge commands.
 */
export const VALID_FLAGS = ['--override-approval-requirement'] as const;

/**
 * Command regex for matching merge commands.
 * Captures optional flags after the merge command.
 */
const COMMAND_REGEX = /^\s*\/lysbot\s+merge(?:\s+(.*))?\s*$/;

/**
 * Domain service for parsing merge commands.
 */
export class CommandParser {
  /**
   * Parses a merge command and extracts options.
   *
   * @param commentBody - The body of the comment containing the command
   * @returns MergeCommand with parsed flags, or null if not a valid command
   *
   * @example
   * parser.parse('/lysbot merge')
   *   // { overrideApprovalRequirement: false }
   * parser.parse('/lysbot merge --override-approval-requirement')
   *   // { overrideApprovalRequirement: true }
   * parser.parse('hello')
   *   // null
   */
  parse(commentBody: string): MergeCommand | null {
    const match = COMMAND_REGEX.exec(commentBody);
    if (!match) {
      return null;
    }

    // Parse and validate flags
    const flagsStr = match[1]?.trim() ?? '';
    const flags = flagsStr ? flagsStr.split(/\s+/) : [];

    // Validate that all flags are known
    const validFlagsArray: readonly string[] = VALID_FLAGS;
    if (!flags.every((flag) => validFlagsArray.includes(flag))) {
      return null;
    }

    return {
      overrideApprovalRequirement: flags.includes('--override-approval-requirement'),
    };
  }

  /**
   * Checks if a comment matches the merge command pattern.
   *
   * @param commentBody - The body of the comment to check
   * @returns true if the comment is a valid merge command
   */
  isCommand(commentBody: string): boolean {
    return this.parse(commentBody) !== null;
  }
}
