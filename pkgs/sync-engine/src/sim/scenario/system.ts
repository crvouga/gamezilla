import type { Session } from '@pkgs/dst';

import type { LocalDomainSchema } from '../../client/local-schema-migrate';
import type {
  MutationFailure,
  MutationRegistry,
} from '../../mutations/core/types';
import type { QueryRegistry } from '../../queries/core/types';
import type { SimSubscription } from '../client-handle';
import type { SimSessionQuery } from '../domain-pack';
import type { SyncKit } from '../kit-api';
import type { SimInfra } from '../kit-boot';
import type { BootedSimKernel, KitClientOpts } from '../kit-types';
import type { ActionShadow } from './action-shadow';
import type { SyncApp } from './app';
import type { ReplayRestartState } from './play';
import type { SyncSurfaceBase } from './surface-types';

/** Outcome of the most recent `mutate` pin on one client. */
export type LastMutation = {
  readonly ok: boolean;
  readonly mutationId: string | null;
  readonly failures: readonly MutationFailure[];
};

/** Settled response of the most recent raw mutations POST on one client. */
export type LastPost = {
  readonly ok: boolean;
  readonly verdicts: readonly {
    readonly mutationId: string;
    readonly status: string;
  }[];
  readonly error?: string;
};

/** Labelled query subscription opened by the `subscribe` pin. */
export type PinnedSubscription = {
  readonly sub: SimSubscription;
  ready: boolean;
};

/** Per-run mutable bag for action replay + converge prep. */
export type SyncRuntime = {
  readonly app: SyncApp;
  readonly sessionQuery?: SimSessionQuery;
  readonly localSchema?: LocalDomainSchema;
  readonly mutationRegistry?: MutationRegistry;
  readonly queryRegistry?: QueryRegistry;
  readonly replay: ReplayRestartState;
  /** Client id → last `mutate` pin result, read by `lastMutationId`. */
  readonly lastMutation: Map<string, LastMutation>;
  /** `clientId:label` → live subscription, read by `subscriptionReady`. */
  readonly subscriptions: Map<string, PinnedSubscription>;
  /** Client id → settled `postMutationsAsync` response, read by `postOutcome`. */
  readonly lastPost: Map<string, LastPost>;
  clientOpts: KitClientOpts;
  infra: SimInfra;
  kernel: BootedSimKernel;
  kit: SyncKit;
};

export function requireKit(runtime: SyncRuntime): SyncKit {
  return runtime.kit;
}

/** Domain surface returned by `defineSyncSystem` / `start`. */
export type SyncSurface = SyncSurfaceBase & {
  readonly session: Session;
  readonly runtime: SyncRuntime;
  readonly shadow: ActionShadow;
  readonly dispose: () => Promise<void>;
};
