import { DefaultWaitService, type WaitService } from './wait-service.js';

export interface MergeModuleDeps {
  waitService: WaitService;
}

export function configureMergeModule(): MergeModuleDeps {
  const waitService: WaitService = new DefaultWaitService();

  return {
    waitService,
  };
}
