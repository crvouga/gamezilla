/**
 * Interface describing the sync engine client.
 */
import type { Sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type {
  MutationStatus,
  UnackedWriteRejection,
} from '../mutations/client/mutation-status';
import type { Mutation } from '../mutations/core/types';
import type {
  SubscribeQueriesHandle,
  SyncEngineQuerySubscriptionSpec,
} from './subscribe-queries-types';
import type { QuerySubscription } from './subscription-runtime';
import type { SyncStatusSubscription } from './sync-status';

export type { MutationStatus, UnackedWriteRejection };

/**
 * A subscription handle for observing changes in a watched query.
 * @template T The type of snapshot returned.
 */
export type WatchSubscription<T> = {
  /**
   * Gets the current value of the watched query.
   * @returns The current snapshot value.
   */
  readonly getSnapshot: () => T;
  /**
   * True after the first async read of the watched query completes.
   * Before hydration, an empty snapshot may mean "unknown" rather than "empty".
   */
  readonly getHydrated: () => boolean;
  /**
   * Subscribes to changes in the watched query.
   * @param listener A callback to invoke when changes occur.
   * @returns A function to unsubscribe.
   */
  readonly subscribe: (listener: () => void) => () => void;
};

/**
 * Interface describing the sync engine client.
 */
export type SyncEngine = {
  /**
   * The SQL client interface used for database operations.
   */
  readonly db: SqlClient;
  /**
   * Watches a given SQL query for updates and provides a subscription handle.
   */
  watch<T extends Record<string, unknown>>(
    query: Sql<T>
  ): WatchSubscription<readonly T[]>;
  /**
   * Connects the sync engine.
   * @returns A promise resolved when the connection is established.
   */
  connect(): Promise<void>;
  /**
   * Disconnects the sync engine.
   * @returns A promise resolved when the disconnection completes.
   */
  disconnect(): Promise<void>;
  /**
   * Clears all local data managed by the sync engine.
   * @returns A promise resolved when the data has been cleared.
   */
  clearLocalData(options?: {
    readonly reason?: 'cache' | 'revoked';
  }): Promise<void>;
  /**
   * Waits until the first successful sync is completed.
   * @returns A promise resolved after the first sync.
   */
  waitForFirstSync(): Promise<void>;
  /**
   * Re-fetch all active query subscriptions; resolves when the sweep finishes.
   * Does not clear local data or reset first-sync gates.
   */
  refreshQueries(): Promise<void>;
  /** Starts a parameterized API query subscription. */
  readonly subscribeQuery: (
    queryName: string,
    parameters: Readonly<Record<string, unknown>>
  ) => QuerySubscription;
  /**
   * Subscribe many parameterized queries for an effect lifetime.
   * Call `unsubscribe` from the effect cleanup.
   */
  readonly subscribeQueries: (
    specs: readonly SyncEngineQuerySubscriptionSpec[]
  ) => SubscribeQueriesHandle;
  /**
   * Provides a subscription to sync status changes.
   * Snapshot shape: `{ connection, online, hasSynced, hasEverSynced, lastError, upgradeRequired }`.
   */
  readonly status: SyncStatusSubscription;
  /**
   * Behavior-level mutation outcome (pending | confirmed | rejected).
   * Do not read framework tables for this.
   */
  readonly mutationOutcome: (mutationId: string) => Promise<MutationStatus>;
  /** Unacknowledged write rejections for this engine's client id. */
  readonly listRejections: () => Promise<readonly UnackedWriteRejection[]>;
  /** Count of local mutations still waiting to upload. */
  readonly pendingMutationCount: () => Promise<number>;
  /** @internal MutationClientProvider / test seam — wake upload drain. */
  readonly wakeUploads: () => void;
  /**
   * @internal MutationClientProvider — optimistic peer fanout after local mutate.
   */
  readonly notifyLocalMutation: (
    mutation: Mutation<unknown>,
    args: unknown,
    capture: import('../sql-ast').WriteCaptureSnapshot
  ) => void;
  /**
   * Attach MQTT push if configured and not already attached (e.g. after
   * `client_config` hydrates an EMQX URL that was missing at connect).
   */
  readonly ensurePush: () => void;
  /**
   * @internal MutationClientProvider / harness harness — register in-flight local
   * mutation work so `disconnect` can drain it before the SQL client closes.
   * Returns a disposer that removes the drain.
   */
  readonly registerMutationDrain: (drain: () => Promise<void>) => () => void;
};
