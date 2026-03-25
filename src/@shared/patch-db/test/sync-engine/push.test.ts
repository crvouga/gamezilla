import { assert } from '@/@shared/assert';
import { describe, expect, test } from 'bun:test';
import { type SyncErrorEvent } from '../../impl-sync';
import { getSim, registerSyncEngineHooks } from './harness';

registerSyncEngineHooks();

describe('SyncPatchesDb (deterministic sim)', () => {
  test('push: create patch is pushed to remote', async () => {
    const sim = getSim();
    const c = sim.client('c1');
    const listId = crypto.randomUUID();
    await c.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'My List',
          'todoList/order': 0,
          'todoList/createdAt': new Date().toISOString(),
        },
      },
    ]);

    await c.push();

    const srv = sim.server('s1');
    const remoteResults = await srv.db.read([
      { entityType: 'todoList', entityId: listId },
    ]);
    const remoteResult = remoteResults[0];
    assert.defined(remoteResult, 'remoteResult must be defined');
    expect(remoteResult.patches).toHaveLength(1);
    const patch = remoteResult.patches[0];
    assert.defined(patch, 'patch must be defined');
    expect(patch.attributes).toMatchObject({
      'todoList/name': 'My List',
      'todoList/order': 0,
    });
  });

  test('push: soft-delete patch is pushed to remote', async () => {
    const sim = getSim();
    const c = sim.client('c1');
    const listId = crypto.randomUUID();
    await c.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'My List',
          'todoList/order': 0,
          'todoList/createdAt': new Date().toISOString(),
        },
      },
    ]);

    await c.push();

    await c.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: { 'todoList/deleted': true },
      },
    ]);

    await c.push();

    const srv = sim.server('s1');
    const remoteResults = await srv.db.read([
      { entityType: 'todoList', entityId: listId },
    ]);
    const remoteResult = remoteResults[0];
    assert.defined(remoteResult, 'remoteResult must be defined');
    expect(remoteResult.patches).toHaveLength(2);
    const deletePatch = remoteResult.patches.find(
      (p) =>
        p.attributes &&
        'todoList/deleted' in p.attributes &&
        p.attributes['todoList/deleted'] === true
    );
    assert.defined(deletePatch, 'deletePatch must be defined');
    expect(deletePatch.attributes).toMatchObject({ 'todoList/deleted': true });
  });

  test('push: multiple unsynced patches are all pushed', async () => {
    const sim = getSim();
    const c = sim.client('c1');
    const listId1 = crypto.randomUUID();
    const listId2 = crypto.randomUUID();
    await c.write([
      {
        entityId: listId1,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'List 1',
          'todoList/order': 0,
          'todoList/createdAt': new Date().toISOString(),
        },
      },
      {
        entityId: listId2,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'List 2',
          'todoList/order': 1,
          'todoList/createdAt': new Date().toISOString(),
        },
      },
    ]);

    await c.push();

    const srv = sim.server('s1');
    const r1Results = await srv.db.read([
      { entityType: 'todoList', entityId: listId1 },
    ]);
    const r1 = r1Results[0];
    assert.defined(r1, 'r1 must be defined');
    const r2Results = await srv.db.read([
      { entityType: 'todoList', entityId: listId2 },
    ]);
    const r2 = r2Results[0];
    assert.defined(r2, 'r2 must be defined');
    expect(r1.patches).toHaveLength(1);
    expect(r2.patches).toHaveLength(1);
    const r1Patch = r1.patches[0];
    assert.defined(r1Patch, 'r1Patch must be defined');
    expect(r1Patch.attributes).toMatchObject({
      'todoList/name': 'List 1',
    });
    const r2Patch = r2.patches[0];
    assert.defined(r2Patch, 'r2Patch must be defined');
    expect(r2Patch.attributes).toMatchObject({
      'todoList/name': 'List 2',
    });
  });

  test('push: SYNC_ERROR_TOPIC after 5 consecutive push failures', async () => {
    const sim = getSim();
    const c = sim.client('c1');
    const listId = crypto.randomUUID();
    await c.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'Needs push',
          'todoList/order': 0,
          'todoList/createdAt': new Date().toISOString(),
        },
      },
    ]);

    const errors: SyncErrorEvent[] = [];
    const unsubSync = sim.subscribeSyncErrors((e) => errors.push(e));

    for (let i = 0; i < 5; i++) {
      c.link.failNextWrite(new Error(`push fail ${i}`));
      const p = c.push();
      await sim.scheduler.drain();
      await p;
    }

    expect(errors).toHaveLength(1);
    expect(errors[0]?.source).toBe('push');
    unsubSync();
  });

  test('push: no SYNC_ERROR_TOPIC when 4 failures then 1 success', async () => {
    const sim = getSim();
    const c = sim.client('c1');
    const listId = crypto.randomUUID();
    await c.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'Eventually ok',
          'todoList/order': 0,
          'todoList/createdAt': new Date().toISOString(),
        },
      },
    ]);

    const errors: SyncErrorEvent[] = [];
    const unsubSync = sim.subscribeSyncErrors((e) => errors.push(e));

    for (let i = 0; i < 4; i++) {
      c.link.failNextWrite(new Error(`push fail ${i}`));
      const p = c.push();
      await sim.scheduler.drain();
      await p;
    }

    await c.push();
    await sim.scheduler.drain();

    expect(errors).toHaveLength(0);

    const srv = sim.server('s1');
    const remote = await srv.db.read([
      { entityType: 'todoList', entityId: listId },
    ]);
    expect((remote[0]?.patches ?? []).length).toBe(1);

    unsubSync();
  });
});
