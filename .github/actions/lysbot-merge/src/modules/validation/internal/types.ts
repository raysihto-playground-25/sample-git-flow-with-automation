export interface CheckResult {
  name: string;
  passed: boolean;
  details?: string;
  optional?: boolean;
}

export interface MergeMethodResult {
  method: 'squash' | 'merge';
  reason: string;
}
