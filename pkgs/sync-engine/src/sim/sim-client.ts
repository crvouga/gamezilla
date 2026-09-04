import type { SqlClient } from '@pkgs/sql-client/interface';

import type { createControllableLifecycle } from '../client/app-lifecycle';
import type { SyncEngine } from '../client/sync-engine-port';
import type { MutationClient } from '../mutations/client/create-mutation-client';
import type { MutateResult, Mutation } from '../mutations/core/types';
import type { SimHttpClient } from './http-bridge';

export type SimClientLifecycle = ReturnType<typeof createControllableLifecycle>;

export type SimClientDbBundle = {
  readonly raw: SqlClient;
  readonly serial: SqlClient;
};

export type SimSubscription = Disposable & {
  readonly ready: Promise<void>;
};

export type SimRejection = {
  readonly id: string;
  readonly mutationId: string;
  readonly code: string;
  readonly message: string;
  readonly meta: string | null;
};

export type SimClient = {
  readonly id: string;
  readonly actorId: string;
  readonly deviceId: string;
  readonly db: SqlClient;
  /** Underlying DB handles for preserveLocalDb restarts. */
  readonly dbBundle: SimClientDbBundle;
  /**
   * Real sync engine — sim internals / settle only.
   * Scenarios: use flattened methods; pool tests use {@link getSyncEngine}.
   */
  readonly engine: SyncEngine;
  /** Controllable lifecycle — prefer `online` / `foreground` in scenarios. */
  readonly lifecycle: SimClientLifecycle;
  /**
   * @internal Pool / identity tests only (CI-allowlisted).
   * Prefer flattened client methods in scenarios.
   */
  readonly getSyncEngine: () => SyncEngine;
  readonly mutate: <A>(m: Mutation<A>, args: A) => Promise<MutateResult>;
  /** @internal Prefer mutate() */
  readonly mutationClient: MutationClient;
  /** @internal Prefer mutate / postMutations allowlist */
  readonly http: SimHttpClient;
  /** createPubSub invocations (bootstrap + each remake). */
  readonly pubsubRemakeCount: () => number;
  /** Live pubsub handler topics for this client. */
  readonly subscribedTopics: () => readonly string[];
  /** Dispose engine + HTTP; optionally keep the SQLite DB for preserveLocalDb. */
  readonly dispose: (opts?: { readonly keepDb?: boolean }) => Promise<void>;

  readonly online: (value: boolean) => void;
  readonly foreground: (value: boolean) => void;
  readonly connect: () => Promise<void>;
  readonly disconnect: () => Promise<void>;
  readonly clearLocalData: (reason: string) => Promise<void>;
  readonly subscribe: (
    name: string,
    params: Readonly<Record<string, unknown>>
  ) => SimSubscription;
  readonly outcome: (mutationId: string) => Promise<'confirmed' | 'rejected'>;
  readonly rejections: () => Promise<readonly SimRejection[]>;
  readonly connection: () => string;
  readonly lastError: () => string | null;
  readonly hasSynced: () => boolean;
  /** Rare explicit wake+refresh. Scenarios need a `// nudge:` comment above. */
  readonly nudge: () => Promise<void>;
  /**
   * @internal Wire-idempotency escape (CI-allowlisted file only).
   * Prefer mutate() in scenarios.
   */
  readonly postMutations: (
    rows: Parameters<SimHttpClient['postMutations']>[0]
  ) => Promise<Awaited<ReturnType<SimHttpClient['postMutations']>>>;
};
