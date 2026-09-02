import type { LocalDomainSchema } from '../../client/local-schema-migrate';
import type { MutationRegistry } from '../../mutations/core/types';
import type { QueryRegistry } from '../../queries/core/types';
import type { SimSessionQuery } from '../domain-pack';
import type { World } from '../world-api';
import type { SimInfra } from '../world-boot';
import type { BootedSimKernel, WorldClientOpts } from '../world-types';
import type { SyncApp } from './app';
import type { ReplayRestartState } from './play';

/**
 * Mutable runtime bag shared by sync node kinds and action dispatch.
 * Built once per `defineSyncSystem` call and closed over by node boot fns.
 */
export type SyncRuntime = {
  readonly app: SyncApp;
  readonly sessionQuery?: SimSessionQuery;
  readonly localSchema?: LocalDomainSchema;
  readonly mutationRegistry?: MutationRegistry;
  readonly queryRegistry?: QueryRegistry;
  readonly replay: ReplayRestartState;
  worldArgs: WorldClientOpts | null;
  infra: SimInfra | null;
  kernel: BootedSimKernel | null;
  kit: World | null;
};

/** @deprecated alias — prefer {@link SyncRuntime} in new code. */
export type SyncSystem = SyncRuntime;

export function requireKit(runtime: SyncRuntime): World {
  const kit = runtime.kit;
  if (kit === null) {
    throw new Error('sync DST: sync.server node has not booted');
  }
  return kit;
}

export function requireInfra(runtime: SyncRuntime): {
  readonly infra: SimInfra;
  readonly worldArgs: WorldClientOpts;
} {
  const { infra, worldArgs } = runtime;
  if (infra === null || worldArgs === null) {
    throw new Error('sync DST: sync.broker node has not booted');
  }
  return { infra, worldArgs };
}
