import { DefaultMergeService } from './default-merge-service.js';
import type { MergeService } from './merge-service.js';

export interface MergeModuleDeps {
  mergeService: MergeService;
}

export function configureMergeModule(): MergeModuleDeps {
  const service: MergeService = new DefaultMergeService();
  return { mergeService: service };
}
