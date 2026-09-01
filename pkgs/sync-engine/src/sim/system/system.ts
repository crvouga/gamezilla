import type { LocalDomainSchema } from '../../client/local-schema-migrate';
import type { SimSessionQuery } from '../domain-pack';
import type { MutationRegistry } from '../../mutations/core/types';
import type { QueryRegistry } from '../../queries/core/types';
import type { SimInfra } from '../world-boot';
import type { BootedSimKernel, WorldClientOpts } from '../world-types';
import type { SyncApp } from './app';
import type { ReplayRestartState } from './play';
import type { SystemWorldSurface } from './world-surface';

/** World facade as seen by DST dispatch (no `world-api` import — no cycles). */
export type SyncSystemFacade = SystemWorldSurface & {
  readonly dispose: () => Promise<void>;
};

/**
 * Mutable system bag shared by `sync.*` node kinds and action dispatch.
 * Built once per `openWorld` call by {@link defineSyncSystem}.
 */
export type SyncSystem = {
  readonly app: SyncApp;
  readonly sessionQuery?: SimSessionQuery;
  readonly localSchema?: LocalDomainSchema;
  readonly mutationRegistry?: MutationRegistry;
  readonly queryRegistry?: QueryRegistry;
  readonly replay: ReplayRestartState;
  worldArgs: WorldClientOpts | null;
  infra: SimInfra | null;
  kernel: BootedSimKernel | null;
  facade: SyncSystemFacade | null;
};

export function requireFacade(system: SyncSystem): SyncSystemFacade {
  const facade = system.facade;
  if (facade === null) {
    throw new Error('sync DST: sync.server node has not booted');
  }
  return facade;
}

export function requireInfra(system: SyncSystem): {
  readonly infra: SimInfra;
  readonly worldArgs: WorldClientOpts;
} {
  const { infra, worldArgs } = system;
  if (infra === null || worldArgs === null) {
    throw new Error('sync DST: sync.broker node has not booted');
  }
  return { infra, worldArgs };
}
