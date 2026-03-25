import { assert } from '@/@shared/assert';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { type SyncErrorEvent } from '../impl-sync';
import { assertEntity, type Patch, type PatchesDbQuery } from '../interface';
import { type Sim, patchDbScenario } from './sim/scenario';

const DELETED_CLAUSE: PatchesDbQuery['where'] = {
  type: 'or',
  clauses: [
    { type: 'not_exists', attribute: 'todoList/deleted' },
    { type: '=', attribute: 'todoList/deleted', value: false },
  ],
};

describe('SyncPatchesDb (deterministic sim)', () => {
  let sim: Sim;

  beforeEach(async () => {
    sim = await patchDbScenario()
      .server('s1')
      .client('c1', { server: 's1' })
      .build();
  });

  afterEach(async () => {
    await sim.destroy();
  });

  test('push: create patch is pushed to remote', async () => {
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

  test('poll: remote patches are merged into local', async () => {
    const c = sim.client('c1');
    const srv = sim.server('s1');
    const listId = crypto.randomUUID();
    await srv.db.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'From Remote',
          'todoList/order': 0,
          'todoList/createdAt': new Date().toISOString(),
        },
      },
    ]);

    const received: unknown[] = [];
    const unsub = c.subscribe.entities(
      { entityType: 'todoList', where: DELETED_CLAUSE },
      (result) => {
        received.push(result.entities);
      }
    );

    await c.poll();

    unsub();

    expect(received.length).toBeGreaterThanOrEqual(1);
    const last = received[received.length - 1] as unknown[];
    assert.all(last, assertEntity);
    expect(
      (
        last as { entityId: string; attributes?: Record<string, unknown> }[]
      ).some(
        (e) =>
          e.entityId === listId &&
          e.attributes?.['todoList/name'] === 'From Remote'
      )
    ).toBe(true);
  });

  test('poll: patches for deleted entities are fetched via tracked-entities query', async () => {
    const c = sim.client('c1');
    const srv = sim.server('s1');
    const listId = crypto.randomUUID();
    await srv.db.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'To Be Deleted',
          'todoList/order': 0,
          'todoList/createdAt': new Date().toISOString(),
        },
      },
    ]);

    const received: {
      entityId: string;
      attributes: Record<string, unknown>;
    }[][] = [];
    const unsub = c.subscribe.entities(
      { entityType: 'todoList', where: DELETED_CLAUSE },
      (result) => {
        received.push(
          result.entities as {
            entityId: string;
            attributes: Record<string, unknown>;
          }[]
        );
      }
    );

    await c.poll();

    expect(received.some((r) => r.some((e) => e.entityId === listId))).toBe(
      true
    );

    await srv.db.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: { 'todoList/deleted': true },
      },
    ]);

    await c.poll();

    unsub();

    const entitiesResults = await c.read([
      { entityType: 'todoList', entityId: listId },
    ]);
    const entitiesResult = entitiesResults[0];
    assert.defined(entitiesResult, 'entitiesResult must be defined');
    const entity = entitiesResult.entities[0];
    assert.defined(entity, 'entity must be defined');
    expect(entity).toBeDefined();
    expect(entity?.attributes?.['todoList/deleted']).toBe(true);
  });

  test('poll: sibling patch from another client is not missed when its patchId sorts before cursor', async () => {
    const c = sim.client('c1');
    const srv = sim.server('s1');
    const entityId = crypto.randomUUID();
    const entityType = 'task';

    const rootWritten = await srv.db.write([
      { entityId, entityType, attributes: { 'task/title': 'Root' } },
    ]);
    const rootPatch = rootWritten[0];
    assert.defined(rootPatch, 'rootPatch must be defined');

    const unsub = c.subscribe.entities({ entityType, entityId }, () => {});
    await c.poll();

    const localResults = await c.read([{ entityType, entityId }]);
    const localAfterFirstPoll = localResults[0];
    assert.defined(localAfterFirstPoll, 'localAfterFirstPoll must be defined');
    expect(localAfterFirstPoll.patches).toHaveLength(1);

    const clientAWritten = await c.write([
      { entityId, entityType, attributes: { 'task/status': 'in-progress' } },
    ]);
    const clientAPatch = clientAWritten[0];
    assert.defined(clientAPatch, 'clientAPatch must be defined');

    await c.push();

    const remoteAfterPushResults = await srv.db.read([
      { entityType, entityId },
    ]);
    const remoteAfterPush = remoteAfterPushResults[0];
    assert.defined(remoteAfterPush, 'remoteAfterPush must be defined');
    expect(remoteAfterPush.patches).toHaveLength(2);

    const siblingPatchId = '00000000-0000-0000-0000-000000000000';
    expect(siblingPatchId < clientAPatch.patchId).toBe(true);

    await srv.db.write([
      {
        entityId,
        entityType,
        patchId: siblingPatchId,
        parentId: rootPatch.patchId,
        createdAt: new Date().toISOString(),
        recordedAt: new Date().toISOString(),
        createdBy: 'other-client',
        sessionId: 'other-session',
        attributes: { 'task/assignee': 'bob' },
      } as Patch,
    ]);

    const remoteAllResults = await srv.db.read([
      { entityType, entityId },
    ]);
    const remoteAll = remoteAllResults[0];
    assert.defined(remoteAll, 'remoteAll must be defined');
    expect(remoteAll.patches).toHaveLength(3);

    await c.poll();

    const finalLocalResults = await c.read([{ entityType, entityId }]);
    const finalLocal = finalLocalResults[0];
    assert.defined(finalLocal, 'finalLocal must be defined');
    unsub();

    const hasSiblingPatch = finalLocal.patches.some(
      (p) => p.patchId === siblingPatchId
    );
    expect(hasSiblingPatch).toBe(true);
    expect(finalLocal.patches).toHaveLength(3);
  });

  test('multi-client: second client polls after first pushes', async () => {
    await sim.destroy();
    sim = await patchDbScenario()
      .server('s')
      .client('a', { server: 's' })
      .client('b', { server: 's' })
      .build();

    const a = sim.client('a');
    const b = sim.client('b');
    const listId = crypto.randomUUID();

    await a.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'Shared',
          'todoList/order': 0,
          'todoList/createdAt': new Date().toISOString(),
        },
      },
    ]);
    await a.push();

    const unsub = b.subscribe.entities(
      { entityType: 'todoList', entityId: listId },
      () => {}
    );
    await b.poll();
    unsub();

    const bLocal = await b.read([
      { entityType: 'todoList', entityId: listId },
    ]);
    expect((bLocal[0]?.patches ?? []).length).toBeGreaterThanOrEqual(1);
  });

  test('partition: client cannot poll until link heals', async () => {
    const c = sim.client('c1');
    const srv = sim.server('s1');
    const listId = crypto.randomUUID();
    await srv.db.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'Remote',
          'todoList/order': 0,
          'todoList/createdAt': new Date().toISOString(),
        },
      },
    ]);

    const unsub = c.subscribe.entities(
      { entityType: 'todoList', entityId: listId },
      () => {}
    );

    c.link.partition();
    await c.poll();

    const mid = await c.read([
      { entityType: 'todoList', entityId: listId },
    ]);
    expect((mid[0]?.patches ?? []).length).toBe(0);

    c.link.heal();
    await c.poll();
    unsub();

    const fin = await c.read([
      { entityType: 'todoList', entityId: listId },
    ]);
    expect((fin[0]?.patches ?? []).length).toBeGreaterThanOrEqual(1);
  });

  test('push: SYNC_ERROR_TOPIC after 5 consecutive push failures', async () => {
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

  test('poll: SYNC_ERROR_TOPIC after 5 consecutive poll failures', async () => {
    const c = sim.client('c1');
    const srv = sim.server('s1');
    const listId = crypto.randomUUID();
    await srv.db.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'Remote',
          'todoList/order': 0,
          'todoList/createdAt': new Date().toISOString(),
        },
      },
    ]);

    const unsub = c.subscribe.entities(
      { entityType: 'todoList', entityId: listId },
      () => {}
    );

    const errors: SyncErrorEvent[] = [];
    const unsubSync = sim.subscribeSyncErrors((e) => errors.push(e));

    for (let i = 0; i < 5; i++) {
      c.link.failNextRead(new Error(`poll fail ${i}`));
      const p = c.poll();
      await sim.scheduler.drain();
      await p;
    }

    expect(errors).toHaveLength(1);
    expect(errors[0]?.source).toBe('poll');
    unsubSync();
    unsub();
  });

  test('push: no SYNC_ERROR_TOPIC when 4 failures then 1 success', async () => {
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

  test('poll: no SYNC_ERROR_TOPIC when 4 failures then 1 success', async () => {
    const c = sim.client('c1');
    const srv = sim.server('s1');
    const listId = crypto.randomUUID();
    await srv.db.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'Remote',
          'todoList/order': 0,
          'todoList/createdAt': new Date().toISOString(),
        },
      },
    ]);

    const unsub = c.subscribe.entities(
      { entityType: 'todoList', entityId: listId },
      () => {}
    );

    const errors: SyncErrorEvent[] = [];
    const unsubSync = sim.subscribeSyncErrors((e) => errors.push(e));

    for (let i = 0; i < 4; i++) {
      c.link.failNextRead(new Error(`poll fail ${i}`));
      const p = c.poll();
      await sim.scheduler.drain();
      await p;
    }

    await c.poll();
    await sim.scheduler.drain();

    expect(errors).toHaveLength(0);

    const local = await c.read([
      { entityType: 'todoList', entityId: listId },
    ]);
    expect((local[0]?.patches ?? []).length).toBeGreaterThanOrEqual(1);

    unsubSync();
    unsub();
  });

  test('poll: overlapping runPollNow coalesces while first read is in flight', async () => {
    const c = sim.client('c1');
    const srv = sim.server('s1');
    const listId = crypto.randomUUID();
    await srv.db.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'Lag',
          'todoList/order': 0,
          'todoList/createdAt': new Date().toISOString(),
        },
      },
    ]);

    c.link.setLatency(20);
    const unsub = c.subscribe.entities(
      { entityType: 'todoList', entityId: listId },
      () => {}
    );

    const p1 = c.syncDb.runPollNow();
    await c.syncDb.runPollNow();

    for (let i = 0; i < 48; i++) {
      if (sim.scheduler.pendingCount() > 0) break;
      await Promise.resolve();
    }
    await sim.scheduler.drain();
    await p1;

    const mid = await c.read([
      { entityType: 'todoList', entityId: listId },
    ]);
    expect((mid[0]?.patches ?? []).length).toBeGreaterThanOrEqual(1);

    unsub();
  });

  test('poll: second poll with no remote changes keeps patch count stable', async () => {
    const c = sim.client('c1');
    const srv = sim.server('s1');
    const listId = crypto.randomUUID();
    await srv.db.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'Stable',
          'todoList/order': 0,
          'todoList/createdAt': new Date().toISOString(),
        },
      },
    ]);

    const unsub = c.subscribe.entities(
      { entityType: 'todoList', entityId: listId },
      () => {}
    );

    await c.poll();
    const afterFirst = await c.read([
      { entityType: 'todoList', entityId: listId },
    ]);
    const n1 = (afterFirst[0]?.patches ?? []).length;
    expect(n1).toBeGreaterThanOrEqual(1);

    await c.poll();
    const afterSecond = await c.read([
      { entityType: 'todoList', entityId: listId },
    ]);
    expect((afterSecond[0]?.patches ?? []).length).toBe(n1);

    unsub();
  });

  test('subscribe: same query stays live with one of two subscribers unsubscribed', async () => {
    const c = sim.client('c1');
    const srv = sim.server('s1');
    const listId = crypto.randomUUID();
    await srv.db.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'Ref',
          'todoList/order': 0,
          'todoList/createdAt': new Date().toISOString(),
        },
      },
    ]);

    const q = { entityType: 'todoList', entityId: listId } as const;
    const u1 = c.subscribe.entities(q, () => {});
    const u2 = c.subscribe.entities(q, () => {});
    u1();

    await srv.db.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: { 'todoList/name': 'Updated After Partial Unsub' },
      },
    ]);

    await c.poll();
    u2();

    const local = await c.read([q]);
    expect(
      (local[0]?.entities ?? []).some(
        (e) => e.attributes?.['todoList/name'] === 'Updated After Partial Unsub'
      )
    ).toBe(true);
  });

  test('poll: subscription limit does not truncate sync; all matching remote lists merge', async () => {
    const c = sim.client('c1');
    const srv = sim.server('s1');
    const created = new Date(0).toISOString();
    const lists = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()];
    for (let i = 0; i < lists.length; i++) {
      const id = lists[i];
      assert.defined(id, 'list id');
      await srv.db.write([
        {
          entityId: id,
          entityType: 'todoList',
          attributes: {
            'todoList/name': `L${i}`,
            'todoList/order': i,
            'todoList/createdAt': created,
          },
        },
      ]);
    }

    const unsub = c.subscribe.entities(
      { entityType: 'todoList', where: DELETED_CLAUSE, limit: 1 },
      () => {}
    );

    await c.poll();
    unsub();

    const all = await c.read([
      { entityType: 'todoList', where: DELETED_CLAUSE },
    ]);
    const entityIds = new Set((all[0]?.entities ?? []).map((e) => e.entityId));
    for (const id of lists) {
      expect(entityIds.has(id)).toBe(true);
    }
  });

  test('multi-client: each client sees lists created by the other after poll', async () => {
    await sim.destroy();
    sim = await patchDbScenario()
      .server('s')
      .client('a', { server: 's' })
      .client('b', { server: 's' })
      .build();

    const a = sim.client('a');
    const b = sim.client('b');
    const srv = sim.server('s');
    const created = new Date(0).toISOString();
    const listA = crypto.randomUUID();
    const listB = crypto.randomUUID();

    const unsubA = a.subscribe.entities(
      { entityType: 'todoList', where: DELETED_CLAUSE },
      () => {}
    );
    const unsubB = b.subscribe.entities(
      { entityType: 'todoList', where: DELETED_CLAUSE },
      () => {}
    );

    await a.write([
      {
        entityId: listA,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'By A',
          'todoList/order': 0,
          'todoList/createdAt': created,
        },
      },
    ]);
    await b.write([
      {
        entityId: listB,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'By B',
          'todoList/order': 1,
          'todoList/createdAt': created,
        },
      },
    ]);

    await a.push();
    await b.push();

    await a.poll();
    await b.poll();

    unsubA();
    unsubB();

    const localA = await a.read([
      { entityType: 'todoList', where: DELETED_CLAUSE },
    ]);
    const localB = await b.read([
      { entityType: 'todoList', where: DELETED_CLAUSE },
    ]);
    const idsA = new Set((localA[0]?.entities ?? []).map((e) => e.entityId));
    const idsB = new Set((localB[0]?.entities ?? []).map((e) => e.entityId));
    expect(idsA.has(listA)).toBe(true);
    expect(idsA.has(listB)).toBe(true);
    expect(idsB.has(listA)).toBe(true);
    expect(idsB.has(listB)).toBe(true);

    const remoteLists = await srv.db.read([
      { entityType: 'todoList', where: DELETED_CLAUSE },
    ]);
    const idsR = new Set((remoteLists[0]?.entities ?? []).map((e) => e.entityId));
    expect(idsR.has(listA)).toBe(true);
    expect(idsR.has(listB)).toBe(true);
  });

  test('subscribe.patches mirrors entities for sync lifecycle', async () => {
    const c = sim.client('c1');
    const srv = sim.server('s1');
    const listId = crypto.randomUUID();
    await srv.db.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'Patch sub',
          'todoList/order': 0,
          'todoList/createdAt': new Date().toISOString(),
        },
      },
    ]);

    const notifications: number[] = [];
    const unsub = c.subscribe.patches(
      { entityType: 'todoList', entityId: listId },
      (result) => {
        notifications.push(result.patches.length);
      }
    );

    await c.poll();
    unsub();

    expect(notifications.some((n) => n >= 1)).toBe(true);
  });
});
