/**
 * MergeOptions value object - Options parsed from the merge command
 *
 * This is a value object representing the configuration extracted from the command.
 */

export interface MergeOptions {
  /**
   * When true, skip the "sufficient approvals" requirement.
   * All other checks (status checks, merge conflicts, labels, etc.) still apply.
   */
  overrideApprovalRequirement: boolean;
}
