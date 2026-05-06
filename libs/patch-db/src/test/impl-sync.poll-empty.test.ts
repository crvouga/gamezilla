import { InMemoryPubSub } from '@gamezilla/lib/pub-sub/impl-in-memory';
import { SqlClientImplBunSqlite } from '@gamezilla/lib/sql-client/impl-bun-sqlite';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { describe, expect, test } from 'bun:test';
import { PatchDbImplClientTransport } from '../impl-client-transport';
import { PatchDbImplSqlite } from '../impl-sqlite/impl-sqlite';
import { SyncPatchDb, type SyncPatchDbScheduler } from '../impl-sync';
import type { PatchDbQuery } from '../interface';
import { PatchDbTransportInProcess } from '../transport/impl-in-process';
import { PatchDbImplSyncHost } from '../transport/impl-sync-host';
import type { PatchDbClientTransport } from '../transport/interface';

describe('SyncPatchDb immediate poll on hydrated empty', () => {
  test('polls immediately when first hydrated local result is empty (once)', async () => {
    let pollIntervalTick: (() => void) | null = null;
    let pollIntervalCalls = 0;
    const scheduler: SyncPatchDbScheduler = {
      scheduleInterval(intervalMs, callback) {
        // pollIntervalMs in SyncPatchDb is 5000 by default; our fixture does not
        // currently override it. Capture only the poll interval registration.
        if (intervalMs === 5000) {
          pollIntervalCalls += 1;
          pollIntervalTick = callback;
          return { cancel: () => {} };
        }
        // push interval (default 10ms in test helper) can be ignored
        return { cancel: () => {} };
      },
    };

    const localClient: SqlClient = SqlClientImplBunSqlite.open(':memory:');
    const remoteClient: SqlClient = SqlClientImplBunSqlite.open(':memory:');
    await localClient.connect();
    await remoteClient.connect();
    const local = new PatchDbImplSqlite(localClient);
    const remoteBacking = new PatchDbImplSqlite(remoteClient);
    await local.migrate();
    await remoteBacking.migrate();

    const remoteHostPubSub = new InMemoryPubSub();
    const remoteHost = new PatchDbImplSyncHost(remoteBacking, remoteHostPubSub);
    const baseTransport = new PatchDbTransportInProcess(remoteHost);

    let remoteReads = 0;
    const countingTransport: PatchDbClientTransport = {
      read: async (queries, ctx) => {
        remoteReads += 1;
        return await baseTransport.read(queries, ctx);
      },
      write: async (patches, ctx) => {
        return await baseTransport.write(patches, ctx);
      },
    };
    const syncRemote = new PatchDbImplClientTransport(countingTransport);
    const pubSub = new InMemoryPubSub();
    const syncDb = new SyncPatchDb(local, syncRemote, pubSub, {
      pushDriver: 'manual',
      pollDriver: 'interval',
      scheduler,
    });

    const qA: PatchDbQuery = { entityType: 'todoList', entityId: 'first' };
    const qB: PatchDbQuery = { entityType: 'todoList', entityId: 'missing' };

    // Subscribe first query to start poll timer + initial poll.
    const unsubA = syncDb.subscribe.entities(qA, () => {});
    await new Promise<void>((r) => queueMicrotask(r));
    await new Promise<void>((r) => queueMicrotask(r));
    expect(pollIntervalCalls).toBe(1);

    // Now subscribe a second, distinct query key that is empty locally.
    // Without the optimization, this would wait for the interval tick because
    // `poll-initial` only runs on the first subscriber that creates the timer.
    remoteReads = 0;
    const unsubB = syncDb.subscribe.entities(qB, () => {});

    // Allow async SQLite reads + poll scheduling to run.
    for (let i = 0; i < 10 && remoteReads === 0; i += 1) {
      await new Promise<void>((r) => setTimeout(r, 1));
    }
    expect(remoteReads).toBeGreaterThan(0);

    // Ensure the empty-trigger is one-shot for this query key: invalidating
    // locals should not cause another immediate remote poll.
    remoteReads = 0;
    syncDb.notifyInvalidated();
    await new Promise<void>((r) => queueMicrotask(r));
    expect(remoteReads).toBe(0);

    // Interval tick may still happen; we don't assert on it here.

    unsubA();
    unsubB();
    syncDb.destroy();
    // Allow any in-flight poll to settle before closing sqlite handles.
    await new Promise<void>((r) => setTimeout(r, 5));
    await localClient.disconnect();
    await remoteClient.disconnect();
  });
});
