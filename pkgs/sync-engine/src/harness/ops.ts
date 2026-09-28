import {
  checkDomainInSync,
  type DomainInSyncCtx,
  type DrainUntilConvergedCtx,
  drainUntilInSyncImpl,
  type RecoverAllCtx,
  recoverAllImpl,
} from './wait-for-in-sync';

export type {
  AddClientArgs,
  BootedHarnessKernel,
  ClientMeta,
  HarnessClientOpts,
} from './types';
export type { DomainInSyncCtx, DrainUntilConvergedCtx, RecoverAllCtx };
export { checkDomainInSync, drainUntilInSyncImpl, recoverAllImpl };
