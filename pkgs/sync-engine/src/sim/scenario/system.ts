import type { Session } from '@pkgs/dst';

import type { LocalDomainSchema } from '../../client/local-schema-migrate';
import type { MutationRegistry } from '../../mutations/core/types';
import type { QueryRegistry } from '../../queries/core/types';
import type { SimSessionQuery } from '../domain-pack';
import type { World } from '../world-api';
import type { SimInfra } from '../world-boot';
import type { BootedSimKernel, WorldClientOpts } from '../world-types';
import type { ActionShadow } from './action-shadow';
import type { SyncApp } from './app';
import type { ReplayRestartState } from './play';
import type { SystemWorldSurface } from './world-surface';

/** Per-run mutable bag for action replay + converge prep. */
export type SyncRuntime = {
  readonly app: SyncApp;
  readonly sessionQuery?: SimSessionQuery;
  readonly localSchema?: LocalDomainSchema;
  readonly mutationRegistry?: MutationRegistry;
  readonly queryRegistry?: QueryRegistry;
  readonly replay: ReplayRestartState;
  worldArgs: WorldClientOpts;
  infra: SimInfra;
  kernel: BootedSimKernel;
  kit: World;
};

export function requireKit(runtime: SyncRuntime): World {
  return runtime.kit;
}

/** Domain surface returned by `defineSyncSystem` / `start`. */
export type SyncSurface = SystemWorldSurface & {
  readonly session: Session;
  readonly runtime: SyncRuntime;
  readonly shadow: ActionShadow;
  readonly dispose: () => Promise<void>;
};
