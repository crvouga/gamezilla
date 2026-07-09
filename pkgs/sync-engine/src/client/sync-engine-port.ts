import type { SqlClient } from '@pkgs/sql-client/interface';
import type { SyncStatusSubscription } from './sync-status';
import type { SyncStreamSubscription } from './sync-stream-subscription';

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
   * @template T The type of records returned by the query.
   * @param sql The SQL query to execute and watch for changes.
   * @param params Optional parameters for the SQL query.
   * @returns A WatchSubscription that provides reactive snapshots of results.
   */
  watch<T extends Record<string, unknown>>(
    sql: string,
    params?: readonly unknown[]
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
  clearLocalData(): Promise<void>;
  /**
   * Waits until the first successful sync is completed.
   * @returns A promise resolved after the first sync.
   */
  waitForFirstSync(): Promise<void>;
  /**
   * Subscribes to a parameterized PowerSync sync stream when supported.
   */
  readonly subscribeSyncStream?: (
    streamName: string,
    parameters: Readonly<Record<string, string | number>>
  ) => Promise<SyncStreamSubscription>;
  /**
   * Provides a subscription to sync status changes.
   */
  readonly status: SyncStatusSubscription;
};
