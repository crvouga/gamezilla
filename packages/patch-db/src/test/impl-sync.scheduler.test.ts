import { assert } from '@gamezilla/lib/assert';
import { describe, expect, test } from 'bun:test';
import {
  defaultSyncPatchDbScheduler,
  type SyncPatchDbScheduler,
} from '../impl-sync';
import { createSyncDbFactory } from './test-helpers';
import { toAttributeState } from '../interface';

describe('SyncPatchDb scheduler hooks', () => {
  test('pushDriver manual does not push until runPushNow', async () => {
    const { syncDb, remote, teardown } = await createSyncDbFactory({
      pushDriver: 'manual',
      pollDriver: 'manual',
    });
    const listId = crypto.randomUUID();
    await syncDb.write([
      {
        entityId: listId,
        entityType: 'todo-list',
        attributes: toAttributeState({
          'todo-list/name': 'X',
          'todo-list/order': 0,
          'todo-list/created-at': new Date(0).toISOString(),
        }),
      },
    ]);

    const remoteBefore = await remote.read([
      { entityType: 'todo-list', entityId: listId },
    ]);
    expect(remoteBefore[0]?.patches ?? []).toHaveLength(0);

    await syncDb.runPushNow();

    const remoteAfter = await remote.read([
      { entityType: 'todo-list', entityId: listId },
    ]);
    const rr = remoteAfter[0];
    assert.defined(rr, 'remote result');
    expect(rr.patches).toHaveLength(1);

    await teardown();
  });

  test('pollDriver manual does not poll automatically; runPollNow merges', async () => {
    const { syncDb, remote, teardown } = await createSyncDbFactory({
      pushDriver: 'manual',
      pollDriver: 'manual',
    });
    const listId = crypto.randomUUID();
    await remote.write([
      {
        entityId: listId,
        entityType: 'todo-list',
        attributes: toAttributeState({
          'todo-list/name': 'Remote Only',
          'todo-list/order': 0,
          'todo-list/created-at': new Date(0).toISOString(),
        }),
      },
    ]);

    const received: unknown[] = [];
    const unsub = syncDb.subscribe.entities(
      { entityType: 'todo-list', entityId: listId },
      (result) => {
        received.push(result.entities);
      }
    );

    const localMid = await syncDb.read([
      { entityType: 'todo-list', entityId: listId },
    ]);
    expect((localMid[0]?.patches ?? []).length).toBe(0);

    await syncDb.runPollNow();
    await new Promise<void>((r) => queueMicrotask(r));

    unsub();

    expect(received.length).toBeGreaterThanOrEqual(1);
    await teardown();
  });

  test('scheduler receives pushIntervalMs from options', async () => {
    let capturedMs: number | null = null;
    let scheduleCalls = 0;
    const customScheduler: SyncPatchDbScheduler = {
      scheduleInterval(intervalMs, callback) {
        scheduleCalls++;
        capturedMs = intervalMs;
        return defaultSyncPatchDbScheduler.scheduleInterval(
          intervalMs,
          callback
        );
      },
    };

    const { syncDb, teardown } = await createSyncDbFactory({
      pushDriver: 'interval',
      pollDriver: 'manual',
      pushIntervalMs: 1234,
      scheduler: customScheduler,
    });

    expect(scheduleCalls).toBe(1);
    assert.defined(
      capturedMs,
      'scheduler should receive pushIntervalMs from options'
    );
    assert.equals(
      capturedMs,
      1234,
      'scheduler should receive pushIntervalMs from options'
    );

    syncDb.destroy();
    await teardown();
  });
});
