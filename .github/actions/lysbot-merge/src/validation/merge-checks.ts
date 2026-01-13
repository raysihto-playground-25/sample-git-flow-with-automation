import { CONVENTIONAL_COMMIT_REGEX } from '../constants/index.js';

export function isConventionalCommitTitle(title: string): boolean {
  return CONVENTIONAL_COMMIT_REGEX.test(title);
}
