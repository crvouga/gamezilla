import type { Session } from '@pkgs/harness-shared/runtime-types';

import type { LocalDomainSchema } from '@pkgs/sync-engine-client/local-schema-migrate';
import type {
  MutationFailure,
  MutationRegistry,
} from '@pkgs/sync-engine-shared/mutations-types';
import type { QueryRegistry } from '@pkgs/sync-engine-shared/queries-types';
import type { SyncHarnessRuntime } from './api';
import type { HarnessSubscription } from './client';
import type { HarnessInfra } from './harness-boot';
import type { HarnessSessionQuery } from './harness-domain-pack';
import type { SyncHarnessBase } from './harness-types';
import type { SyncApp } from './scenario-app';
import type { BootedHarnessKernel, HarnessClientOpts } from './types';

/** Outcome of the most recent `mutate` pin on one client. */

/** Clients that must restart (crash / revoke / tamper / cut) before converge. */
export type OwedRestart = {
  readonly restart: Set<string>;
  readonly fresh: Set<string>;
};

export function createOwedRestart(): OwedRestart {
  return { restart: new Set(), fresh: new Set() };
}

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
  readonly sub: HarnessSubscription;
  ready: boolean;
};

/** Per-run mutable bag for pin results + converge prep. */
export type SyncRuntime = {
  readonly app: SyncApp;
  readonly sessionQuery?: HarnessSessionQuery;
  readonly localSchema?: LocalDomainSchema;
  readonly mutationRegistry?: MutationRegistry;
  readonly queryRegistry?: QueryRegistry;
  /** Clients the pool crashed / revoked / cut — remade by `connect`, `restart`, `recoverAll`. */
  readonly owed: OwedRestart;
  /** Subscriptions opened by the `subscribe` pool action; dropped on `restoreNetwork`. */
  readonly poolSubscriptions: Set<Disposable>;
  /** Client id → last `mutate` pin result, read by `lastMutationId`. */
  readonly lastMutation: Map<string, LastMutation>;
  /** `clientId:label` → live subscription, read by `subscriptionReady`. */
  readonly subscriptions: Map<string, PinnedSubscription>;
  /** Client id → settled `postMutationsAsync` response, read by `postOutcome`. */
  readonly lastPost: Map<string, LastPost>;
  clientOpts: HarnessClientOpts;
  infra: HarnessInfra;
  kernel: BootedHarnessKernel;
  kit: SyncHarnessRuntime;
};

export function requireKit(runtime: SyncRuntime): SyncHarnessRuntime {
  return runtime.kit;
}

/** Domain surface returned by every sync system's `create`. */
export type SyncHarness = SyncHarnessBase & {
  readonly session: Session;
  readonly runtime: SyncRuntime;
  readonly dispose: () => Promise<void>;
};
