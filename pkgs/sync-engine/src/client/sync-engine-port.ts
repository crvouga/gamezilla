/**
 * Interface describing the sync engine client.
 */
import type { Sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type {
  SubscribeQueriesHandle,
  SyncEngineQuerySubscriptionSpec,
} from './subscribe-queries-types';
import type { QuerySubscription } from './subscription-runtime';
import type { SyncStatusSubscription } from './sync-status';

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
   */
  readonly status: SyncStatusSubscription;
  /** Wake the mutation upload loop (e.g. after a local `mutate` commit). */
  readonly wakeUploads: () => void;
};
