/**
 * MergeCommand.ts - Merge command domain entity
 *
 * Represents a parsed merge command with its options.
 */

/**
 * Options parsed from the merge command.
 */
export interface MergeCommand {
  /**
   * When true, skip the "sufficient approvals" requirement.
   * All other checks (status checks, merge conflicts, etc.) still apply.
   */
  overrideApprovalRequirement: boolean;
}
