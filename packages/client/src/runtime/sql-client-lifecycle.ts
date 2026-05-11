import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import {
  forceDetachPatchDbEntitySubscriptionsForDb,
  forceDetachPatchDbQuerySubscriptionsForDb,
} from '@gamezilla/patch-db/react';
import type { SubscribablePatchDbLike } from '@gamezilla/patch-db/subscribable';

import { openSqlClientForPlatform } from './store/open-sql-client';

/**
 * expo-sqlite **web** multiplexes every DB into one shared {@link Worker}. If
 * `openDatabaseAsync` / `closeAsync` / `deleteDatabaseAsync` overlap across
 * connection swaps, the worker can process messages out of order and surface
 * a worker-level rejection at `WorkerChannel.ts:64` (`new Error(error)`).
 *
 * Serialize every connection-lifecycle worker call — **open** (from this
 * module), **disconnect** (abort), and direct **delete** (sign-in/sign-out
 * cleanup) — on one tail so they never interleave on the shared worker.
 */
let sqlClientLifecycleTail: Promise<unknown> = Promise.resolve();

/** Queue connection-lifecycle work (open/close/delete) on the shared tail. */
export function enqueueSqlClientLifecycle<T>(fn: () => Promise<T>): Promise<T> {
  const job = sqlClientLifecycleTail.then(fn, fn) as Promise<T>;
  sqlClientLifecycleTail = job.then(
    () => undefined,
    () => undefined
  );
  return job;
}

/** Await all opens/disconnects/deletes already enqueued on the lifecycle tail. */
export async function awaitSqlClientDisconnectChain(): Promise<void> {
  await sqlClientLifecycleTail;
}

type PatchStackCleanupEntry = {
  id: string;
  cleanup: (reason: 'replaced' | 'abort') => void;
};

let activePatchStackCleanup: PatchStackCleanupEntry | null = null;

type SqlClientCleanupEntry = {
  id: string;
  accountKey: string;
  client: SqlClient;
  disconnect: () => Promise<unknown>;
};

let activeSqlClientCleanup: SqlClientCleanupEntry | null = null;

async function disconnectActiveSqlClientIfAny(): Promise<void> {
  const prev = activeSqlClientCleanup;
  if (prev === null) return;
  activeSqlClientCleanup = null;
  await prev.disconnect().catch(() => undefined);
}

export function registerPatchStackCleanup(args: {
  decorated: SubscribablePatchDbLike;
  sync: { destroy(): void };
  signal: AbortSignal;
}): void {
  const { decorated, sync, signal } = args;
  const stackId = `stack-${String(Date.now())}-${Math.random().toString(36).slice(2, 8)}`;
  let cleaned = false;
  const cleanup = (_reason: 'replaced' | 'abort') => {
    if (cleaned) return;
    cleaned = true;
    forceDetachPatchDbQuerySubscriptionsForDb(decorated);
    forceDetachPatchDbEntitySubscriptionsForDb(decorated);
    sync.destroy();
    if (activePatchStackCleanup?.id === stackId) {
      activePatchStackCleanup = null;
    }
  };
  if (activePatchStackCleanup !== null) {
    activePatchStackCleanup.cleanup('replaced');
  }
  activePatchStackCleanup = { id: stackId, cleanup };
  signal.addEventListener('abort', () => cleanup('abort'));
}

export async function openSqlClientWithLifecycle(args: {
  getAccountId: () => string | null;
  getDeviceId: () => string;
  signal: AbortSignal;
}): Promise<SqlClient> {
  const accountKey = args.getAccountId() ?? '<anon>';
  const sql = await enqueueSqlClientLifecycle(async () => {
    if (
      activeSqlClientCleanup !== null &&
      activeSqlClientCleanup.accountKey === accountKey
    ) {
      return activeSqlClientCleanup.client;
    }
    await disconnectActiveSqlClientIfAny();
    const opened = await openSqlClientForPlatform({
      getAccountId: args.getAccountId,
      getDeviceId: args.getDeviceId,
    });
    const id = `sql-${String(Date.now())}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;
    activeSqlClientCleanup = {
      id,
      accountKey,
      client: opened,
      disconnect: () => opened.disconnect(),
    };
    return opened;
  });

  const entry = activeSqlClientCleanup;
  if (entry === null || entry.client !== sql) {
    throw new Error('openSqlClientWithLifecycle: lifecycle invariant failed');
  }

  args.signal.addEventListener('abort', () => {
    if (activeSqlClientCleanup !== entry) {
      return;
    }
    activeSqlClientCleanup = null;
    void enqueueSqlClientLifecycle(() =>
      entry.client.disconnect().catch(() => {})
    );
  });

  return sql;
}
