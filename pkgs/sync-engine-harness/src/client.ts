import type { SqlClient } from '@pkgs/sql-client-shared/interface';
import type { MutationClient } from '@pkgs/sync-engine-client/create-mutation-client';
import type { SyncEngine } from '@pkgs/sync-engine-client/sync-engine-port';
import type { createControllableLifecycle } from '@pkgs/sync-engine-shared/app-lifecycle';
import type {
  MutateResult,
  Mutation,
} from '@pkgs/sync-engine-shared/mutations-types';
import type { HarnessHttpClient } from './http-bridge';

export type HarnessClientLifecycle = ReturnType<
  typeof createControllableLifecycle
>;

export type HarnessClientDbBundle = {
  readonly raw: SqlClient;
  readonly serial: SqlClient;
};

export type HarnessSubscription = Disposable & {
  readonly ready: Promise<void>;
};

export type HarnessRejection = {
  readonly id: string;
  readonly mutationId: string;
  readonly code: string;
  readonly message: string;
  readonly meta: string | null;
};

export type HarnessClient = {
  readonly id: string;
  readonly actorId: string;
  readonly deviceId: string;
  readonly db: SqlClient;
  /** Underlying DB handles for preserveLocalDb restarts. */
  readonly dbBundle: HarnessClientDbBundle;
  /**
   * Real sync engine — harness internals / settle only.
   * Scenarios: use flattened methods; pool tests use {@link getSyncEngine}.
   */
  readonly engine: SyncEngine;
  /** Controllable lifecycle — prefer `online` / `foreground` in scenarios. */
  readonly lifecycle: HarnessClientLifecycle;
  /**
   * @internal Pool / identity tests only (CI-allowlisted).
   * Prefer flattened client methods in scenarios.
   */
  readonly getSyncEngine: () => SyncEngine;
  readonly mutate: <A>(m: Mutation<A>, args: A) => Promise<MutateResult>;
  /** @internal Prefer mutate() */
  readonly mutationClient: MutationClient;
  /** @internal Prefer mutate / postMutations allowlist */
  readonly http: HarnessHttpClient;
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
  ) => HarnessSubscription;
  readonly outcome: (mutationId: string) => Promise<'confirmed' | 'rejected'>;
  readonly rejections: () => Promise<readonly HarnessRejection[]>;
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
    rows: Parameters<HarnessHttpClient['postMutations']>[0]
  ) => Promise<Awaited<ReturnType<HarnessHttpClient['postMutations']>>>;
};
