import { assert } from '@pkgs/assert';
import { describe, expect, test } from 'bun:test';
import { type SyncErrorEvent } from '../../impl-sync';
import { DELETED_CLAUSE } from './constants';
import { getSim, registerSyncEngineHooks } from './harness';
import { toAttributeState } from '../../interface';
import { QTodoList } from '../query-test-attrs';

const VIZ_FILE = import.meta.path;

registerSyncEngineHooks();

describe('SyncPatchDb (deterministic sim)', () => {
  test('push: create patch is pushed to remote', async () => {
    const sim = getSim();
    sim.setMeta({
      title: 'Push: create patch is pushed to remote',
      intent: 'Unsynced local patch appears on server after a successful push.',
      source: {
        testFile: VIZ_FILE,
        testName: 'push: create patch is pushed to remote',
      },
    });
    const c = sim.client('c1');
    const srv = sim.server('s1');
    const listId = crypto.randomUUID();
    const listQuery = {
      entityType: 'todo-list',
      where: DELETED_CLAUSE,
    } as const;
    const unsub = c.subscribe.entities(listQuery, () => {});

    await c.write([
      {
        entityId: listId,
        entityType: 'todo-list',
        attributes: toAttributeState({
          'todo-list/name': 'My List',
          'todo-list/order': 0,
          'todo-list/created-at': new Date().toISOString(),
        }),
      },
    ]);

    await c.push();

    const remoteResults = await srv.db.read([
      { entityType: 'todo-list', entityId: listId },
    ]);
    const remoteResult = remoteResults[0];
    assert.defined(remoteResult, 'remoteResult must be defined');
    expect(remoteResult.patches).toHaveLength(1);
    const patch = remoteResult.patches[0];
    assert.defined(patch, 'patch must be defined');
    expect(patch.attributes).toMatchObject({
      'todo-list/name': 'My List',
      'todo-list/order': 0,
    });

    await c.poll();
    unsub();
    await sim.assertConsistent(listQuery);
  });

  test('push: soft-delete patch is pushed to remote', async () => {
    const sim = getSim();
    sim.setMeta({
      title: 'Push: soft-delete patch is pushed to remote',
      intent: 'Deletion flags sync in a second push after entity creation.',
      source: {
        testFile: VIZ_FILE,
        testName: 'push: soft-delete patch is pushed to remote',
      },
    });
    const c = sim.client('c1');
    const srv = sim.server('s1');
    const listId = crypto.randomUUID();
    const listQuery = {
      entityType: 'todo-list',
      where: DELETED_CLAUSE,
    } as const;
    const unsub = c.subscribe.entities(listQuery, () => {});

    await c.write([
      {
        entityId: listId,
        entityType: 'todo-list',
        attributes: toAttributeState({
          'todo-list/name': 'My List',
          'todo-list/order': 0,
          'todo-list/created-at': new Date().toISOString(),
        }),
      },
    ]);

    await c.push();

    await c.write([
      {
        entityId: listId,
        entityType: 'todo-list',
        attributes: toAttributeState({ 'todo-list/deleted': true }),
      },
    ]);

    await c.push();

    const remoteResults = await srv.db.read([
      { entityType: 'todo-list', entityId: listId },
    ]);
    const remoteResult = remoteResults[0];
    assert.defined(remoteResult, 'remoteResult must be defined');
    expect(remoteResult.patches).toHaveLength(2);
    const deletePatch = remoteResult.patches.find(
      (p) =>
        p.attributes &&
        QTodoList.deleted.key in p.attributes &&
        p.attributes[QTodoList.deleted.key] === true
    );
    assert.defined(deletePatch, 'deletePatch must be defined');
    expect(deletePatch.attributes).toMatchObject({
      [QTodoList.deleted.key]: true,
    });

    await c.poll();
    unsub();
    await sim.assertConsistent(listQuery);
  });

  test('push: multiple unsynced patches are all pushed', async () => {
    const sim = getSim();
    sim.setMeta({
      title: 'Push: multiple unsynced patches are all pushed',
      intent: 'One push cycle uploads every outstanding unsynced patch.',
      source: {
        testFile: VIZ_FILE,
        testName: 'push: multiple unsynced patches are all pushed',
      },
    });
    const c = sim.client('c1');
    const srv = sim.server('s1');
    const listId1 = crypto.randomUUID();
    const listId2 = crypto.randomUUID();
    const listQuery = {
      entityType: 'todo-list',
      where: DELETED_CLAUSE,
    } as const;
    const unsub = c.subscribe.entities(listQuery, () => {});

    await c.write([
      {
        entityId: listId1,
        entityType: 'todo-list',
        attributes: toAttributeState({
          'todo-list/name': 'List 1',
          'todo-list/order': 0,
          'todo-list/created-at': new Date().toISOString(),
        }),
      },
      {
        entityId: listId2,
        entityType: 'todo-list',
        attributes: toAttributeState({
          'todo-list/name': 'List 2',
          'todo-list/order': 1,
          'todo-list/created-at': new Date().toISOString(),
        }),
      },
    ]);

    await c.push();

    const r1Results = await srv.db.read([
      { entityType: 'todo-list', entityId: listId1 },
    ]);
    const r1 = r1Results[0];
    assert.defined(r1, 'r1 must be defined');
    const r2Results = await srv.db.read([
      { entityType: 'todo-list', entityId: listId2 },
    ]);
    const r2 = r2Results[0];
    assert.defined(r2, 'r2 must be defined');
    expect(r1.patches).toHaveLength(1);
    expect(r2.patches).toHaveLength(1);
    const r1Patch = r1.patches[0];
    assert.defined(r1Patch, 'r1Patch must be defined');
    expect(r1Patch.attributes).toMatchObject({
      'todo-list/name': 'List 1',
    });
    const r2Patch = r2.patches[0];
    assert.defined(r2Patch, 'r2Patch must be defined');
    expect(r2Patch.attributes).toMatchObject({
      'todo-list/name': 'List 2',
    });

    await c.poll();
    unsub();
    await sim.assertConsistent(listQuery);
  });

  test('push: SYNC_ERROR_TOPIC after 5 consecutive push failures', async () => {
    const sim = getSim();
    sim.setMeta({
      title: 'Push: SYNC_ERROR_TOPIC after 5 consecutive failures',
      intent: 'Repeated transport errors surface on pub/sub after threshold.',
      source: {
        testFile: VIZ_FILE,
        testName: 'push: SYNC_ERROR_TOPIC after 5 consecutive push failures',
      },
    });
    const c = sim.client('c1');
    const listId = crypto.randomUUID();
    const listQuery = {
      entityType: 'todo-list',
      where: DELETED_CLAUSE,
    } as const;
    const unsub = c.subscribe.entities(listQuery, () => {});

    await c.write([
      {
        entityId: listId,
        entityType: 'todo-list',
        attributes: toAttributeState({
          'todo-list/name': 'Needs push',
          'todo-list/order': 0,
          'todo-list/created-at': new Date().toISOString(),
        }),
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

    await c.push();
    await c.poll();
    unsubSync();
    unsub();
    await sim.assertConsistent(listQuery);
  });

  test('push: no SYNC_ERROR_TOPIC when 4 failures then 1 success', async () => {
    const sim = getSim();
    sim.setMeta({
      title: 'Push: recovery before fatal SYNC_ERROR_TOPIC threshold',
      intent:
        'Below threshold, a successful push clears streak; no sync_error event.',
      source: {
        testFile: VIZ_FILE,
        testName: 'push: no SYNC_ERROR_TOPIC when 4 failures then 1 success',
      },
    });
    const c = sim.client('c1');
    const srv = sim.server('s1');
    const listId = crypto.randomUUID();
    const listQuery = {
      entityType: 'todo-list',
      where: DELETED_CLAUSE,
    } as const;
    const unsub = c.subscribe.entities(listQuery, () => {});

    await c.write([
      {
        entityId: listId,
        entityType: 'todo-list',
        attributes: toAttributeState({
          'todo-list/name': 'Eventually ok',
          'todo-list/order': 0,
          'todo-list/created-at': new Date().toISOString(),
        }),
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

    const remote = await srv.db.read([
      { entityType: 'todo-list', entityId: listId },
    ]);
    expect((remote[0]?.patches ?? []).length).toBe(1);

    await c.poll();
    unsubSync();
    unsub();
    await sim.assertConsistent(listQuery);
  });
});
