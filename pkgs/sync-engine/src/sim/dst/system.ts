import type { SimSessionQuery } from '../domain-pack';
import type { SimInfra } from '../world-boot';
import type { BootedSimKernel, WorldClientOpts } from '../world-types';
import type { DstApp } from './app';
import type { ReplayRestartState } from './play';
import type { DstWorldSurface } from './world-surface';

/** World facade as seen by DST dispatch (no `world-api` import — no cycles). */
export type SyncDstFacade = DstWorldSurface & {
  readonly dispose: () => Promise<void>;
};

/**
 * Mutable system bag shared by `sync.*` node kinds and action dispatch.
 * Built once per `openDstWorld` call by {@link defineSyncDst}.
 */
export type SyncDstSystem = {
  readonly app: DstApp;
  readonly sessionQuery?: SimSessionQuery;
  readonly replay: ReplayRestartState;
  worldArgs: WorldClientOpts | null;
  infra: SimInfra | null;
  kernel: BootedSimKernel | null;
  facade: SyncDstFacade | null;
};

export function requireFacade(system: SyncDstSystem): SyncDstFacade {
  const facade = system.facade;
  if (facade === null) {
    throw new Error('sync DST: sync.server node has not booted');
  }
  return facade;
}

export function requireInfra(system: SyncDstSystem): {
  readonly infra: SimInfra;
  readonly worldArgs: WorldClientOpts;
} {
  const { infra, worldArgs } = system;
  if (infra === null || worldArgs === null) {
    throw new Error('sync DST: sync.broker node has not booted');
  }
  return { infra, worldArgs };
}
