export interface WaitService {
  waitBeforeRetryMs(ms: number): Promise<void>;
}

export class DefaultWaitService implements WaitService {
  waitBeforeRetryMs(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
