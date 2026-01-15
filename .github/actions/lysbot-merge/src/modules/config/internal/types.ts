export interface ActionConfig {
  releaseBranchPrefix: string;
  developBranch: string;
  syncBranchPrefix: string;
  mergeableRetryCount: number;
  mergeableRetryInterval: number;
}

export interface EventContext {
  owner: string;
  repo: string;
  prNumber: number;
  commentId: number;
  commentBody: string;
  actor: string;
  userType: string;
  authorAssociation: string;
  serverUrl: string;
  runId: number;
  eventName: string;
  isPullRequest: boolean;
}

export interface MergeOptions {
  overrideApprovalRequirement: boolean;
}
