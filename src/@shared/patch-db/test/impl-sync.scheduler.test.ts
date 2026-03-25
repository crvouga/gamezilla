import { assert } from '@/@shared/assert';
import { describe, expect, test } from 'bun:test';
import {
  defaultSyncPatchesDbPushScheduler,
  type SyncPatchesDbPushScheduler,
} from '../impl-sync';
import { createSyncDbFactory } from './test-helpers';

describe('SyncPatchesDb scheduler hooks', () => {
  test('pushDriver manual does not push until runPushNow', async () => {
    const { syncDb, remote, teardown } = await createSyncDbFactory({
      pushDriver: 'manual',
      pollDriver: 'manual',
    });
    const listId = crypto.randomUUID();
    await syncDb.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'X',
          'todoList/order': 0,
          'todoList/createdAt': new Date(0).toISOString(),
        },
      },
    ]);

    const remoteBefore = await remote.read([
      { entityType: 'todoList', entityId: listId },
    ]);
    expect(remoteBefore[0]?.patches ?? []).toHaveLength(0);

    await syncDb.runPushNow();

    const remoteAfter = await remote.read([
      { entityType: 'todoList', entityId: listId },
    ]);
    const rr = remoteAfter[0];
    assert.defined(rr, 'remote result');
    expect(rr.patches).toHaveLength(1);

    await teardown();
  });

  test('pollDriver manual does not poll on invalidate; runPollNow merges', async () => {
    const { syncDb, remote, invalidateRemote, teardown } =
      await createSyncDbFactory({
        pushDriver: 'manual',
        pollDriver: 'manual',
      });
    const listId = crypto.randomUUID();
    await remote.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'Remote Only',
          'todoList/order': 0,
          'todoList/createdAt': new Date(0).toISOString(),
        },
      },
    ]);

    const received: unknown[] = [];
    const unsub = syncDb.subscribe.entities(
      { entityType: 'todoList', entityId: listId },
      (result) => {
        received.push(result.entities);
      }
    );

    invalidateRemote();

    const localMid = await syncDb.read([
      { entityType: 'todoList', entityId: listId },
    ]);
    expect((localMid[0]?.patches ?? []).length).toBe(0);

    await syncDb.runPollNow();
    await new Promise<void>((r) => queueMicrotask(r));

    unsub();

    expect(received.length).toBeGreaterThanOrEqual(1);
    await teardown();
  });

  test('pushScheduler receives pushIntervalMs from options', async () => {
    let capturedMs: number | null = null;
    let scheduleCalls = 0;
    const customScheduler: SyncPatchesDbPushScheduler = {
      scheduleInterval(intervalMs, callback) {
        scheduleCalls++;
        capturedMs = intervalMs;
        return defaultSyncPatchesDbPushScheduler.scheduleInterval(
          intervalMs,
          callback
        );
      },
    };

    const { syncDb, teardown } = await createSyncDbFactory({
      pushDriver: 'interval',
      pollDriver: 'manual',
      pushIntervalMs: 1234,
      pushScheduler: customScheduler,
    });

    expect(scheduleCalls).toBe(1);
    assert.equals(
      capturedMs,
      1234,
      'pushScheduler should receive pushIntervalMs from options'
    );

    syncDb.destroy();
    await teardown();
  });
});
