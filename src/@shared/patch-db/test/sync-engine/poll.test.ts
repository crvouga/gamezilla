import { assert } from '@/@shared/assert';
import { describe, expect, test } from 'bun:test';
import { type SyncErrorEvent } from '../../impl-sync';
import { assertEntity, type Patch } from '../../interface';
import { DELETED_CLAUSE } from './constants';
import { getSim, registerSyncEngineHooks } from './harness';

const VIZ_FILE = import.meta.path;

registerSyncEngineHooks();

describe('SyncPatchesDb (deterministic sim)', () => {
  test('poll: remote patches are merged into local', async () => {
    const sim = getSim();
    sim.setMeta({
      title: 'Poll: remote patches merge into local',
      intent:
        'Server writes become visible locally after poll with active subscription.',
      source: {
        testFile: VIZ_FILE,
        testName: 'poll: remote patches are merged into local',
      },
    });
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

    await sim.assertConsistent({ entityType: 'todoList', where: DELETED_CLAUSE });
  });

  test('poll: patches for deleted entities are fetched via tracked-entities query', async () => {
    const sim = getSim();
    sim.setMeta({
      title: 'Poll: tracked entities pick up delete patches',
      intent: 'Second poll includes soft-delete patch for subscribed lists.',
      source: {
        testFile: VIZ_FILE,
        testName:
          'poll: patches for deleted entities are fetched via tracked-entities query',
      },
    });
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

    await sim.assertEntitiesConsistent('todoList', [listId]);
  });

  test('poll: sibling patch from another client is not missed when its patchId sorts before cursor', async () => {
    const sim = getSim();
    sim.setMeta({
      title:
        'Poll: cursor does not skip lexicographically earlier sibling patch',
      intent:
        'Merge logic fetches all known patches, including IDs before cursor.',
      source: {
        testFile: VIZ_FILE,
        testName:
          'poll: sibling patch from another client is not missed when its patchId sorts before cursor',
      },
    });
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

    const remoteAllResults = await srv.db.read([{ entityType, entityId }]);
    const remoteAll = remoteAllResults[0];
    assert.defined(remoteAll, 'remoteAll must be defined');
    expect(remoteAll.patches).toHaveLength(3);

    await c.poll();

    const finalLocalResults = await c.read([{ entityType, entityId }]);
    const finalLocal = finalLocalResults[0];
    assert.defined(finalLocal, 'finalLocal must be defined');

    const hasSiblingPatch = finalLocal.patches.some(
      (p) => p.patchId === siblingPatchId
    );
    expect(hasSiblingPatch).toBe(true);
    expect(finalLocal.patches).toHaveLength(3);

    unsub();

    await sim.assertEntitiesConsistent('task', [entityId]);
  });

  test('partition: client cannot poll until link heals', async () => {
    const sim = getSim();
    sim.setMeta({
      title: 'Partition: poll blocked until heal',
      intent: 'Partitioned link prevents remote read; heal allows merge again.',
      source: {
        testFile: VIZ_FILE,
        testName: 'partition: client cannot poll until link heals',
      },
    });
    const c = sim.client('c1');
    const srv = sim.server('s1');
    const listId = crypto.randomUUID();
    const listQuery = {
      entityType: 'todoList',
      where: DELETED_CLAUSE,
    } as const;
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

    const unsub = c.subscribe.entities(listQuery, () => {});

    c.link.partition();
    await c.poll();

    const mid = await c.read([{ entityType: 'todoList', entityId: listId }]);
    expect((mid[0]?.patches ?? []).length).toBe(0);

    c.link.heal();
    await c.poll();

    const fin = await c.read([{ entityType: 'todoList', entityId: listId }]);
    expect((fin[0]?.patches ?? []).length).toBeGreaterThanOrEqual(1);

    unsub();

    await sim.assertConsistent(listQuery);
  });

  test('poll: SYNC_ERROR_TOPIC after 5 consecutive poll failures', async () => {
    const sim = getSim();
    sim.setMeta({
      title: 'Poll: SYNC_ERROR_TOPIC after 5 consecutive failures',
      intent: 'Repeated poll read failures publish sync_error after threshold.',
      source: {
        testFile: VIZ_FILE,
        testName: 'poll: SYNC_ERROR_TOPIC after 5 consecutive poll failures',
      },
    });
    const c = sim.client('c1');
    const srv = sim.server('s1');
    const listId = crypto.randomUUID();
    const listQuery = {
      entityType: 'todoList',
      where: DELETED_CLAUSE,
    } as const;
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

    const unsub = c.subscribe.entities(listQuery, () => {});

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

    await c.poll();
    unsubSync();
    unsub();

    await sim.assertConsistent(listQuery);
  });

  test('poll: no SYNC_ERROR_TOPIC when 4 failures then 1 success', async () => {
    const sim = getSim();
    sim.setMeta({
      title: 'Poll: recovery before fatal threshold',
      intent: 'Successful poll resets failure streak; no sync_error event.',
      source: {
        testFile: VIZ_FILE,
        testName: 'poll: no SYNC_ERROR_TOPIC when 4 failures then 1 success',
      },
    });
    const c = sim.client('c1');
    const srv = sim.server('s1');
    const listId = crypto.randomUUID();
    const listQuery = {
      entityType: 'todoList',
      where: DELETED_CLAUSE,
    } as const;
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

    const unsub = c.subscribe.entities(listQuery, () => {});

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

    const local = await c.read([{ entityType: 'todoList', entityId: listId }]);
    expect((local[0]?.patches ?? []).length).toBeGreaterThanOrEqual(1);

    unsubSync();
    unsub();

    await sim.assertConsistent(listQuery);
  });

  test('poll: overlapping runPollNow coalesces while first read is in flight', async () => {
    const sim = getSim();
    sim.setMeta({
      title: 'Poll: overlapping runPollNow coalesces',
      intent:
        'Concurrent polls share one in-flight read; no duplicate merge corruption.',
      source: {
        testFile: VIZ_FILE,
        testName:
          'poll: overlapping runPollNow coalesces while first read is in flight',
      },
    });
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
    const listQuery = { entityType: 'todoList', where: DELETED_CLAUSE } as const;
    const unsub = c.subscribe.entities(listQuery, () => {});

    const p1 = c.syncDb.runPollNow();
    await c.syncDb.runPollNow();

    for (let i = 0; i < 48; i++) {
      if (sim.scheduler.pendingCount() > 0) break;
      await Promise.resolve();
    }
    await sim.scheduler.drain();
    await p1;

    const mid = await c.read([{ entityType: 'todoList', entityId: listId }]);
    expect((mid[0]?.patches ?? []).length).toBeGreaterThanOrEqual(1);

    unsub();

    await sim.assertConsistent(listQuery);
  });

  test('poll: second poll with no remote changes keeps patch count stable', async () => {
    const sim = getSim();
    sim.setMeta({
      title: 'Poll: idempotent when remote unchanged',
      intent: 'Second poll does not duplicate patches locally.',
      source: {
        testFile: VIZ_FILE,
        testName:
          'poll: second poll with no remote changes keeps patch count stable',
      },
    });
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

    const listQuery = { entityType: 'todoList', where: DELETED_CLAUSE } as const;
    const unsub = c.subscribe.entities(listQuery, () => {});

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

    await sim.assertConsistent(listQuery);
  });

  test('poll: subscription limit does not truncate sync; all matching remote lists merge', async () => {
    const sim = getSim();
    sim.setMeta({
      title: 'Poll: list query limit does not drop entities from sync',
      intent:
        'Sync merges all matching server entities despite subscribe limit.',
      source: {
        testFile: VIZ_FILE,
        testName:
          'poll: subscription limit does not truncate sync; all matching remote lists merge',
      },
    });
    const c = sim.client('c1');
    const srv = sim.server('s1');
    const created = new Date(0).toISOString();
    const lists = [
      crypto.randomUUID(),
      crypto.randomUUID(),
      crypto.randomUUID(),
    ];
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

    const listQuery = { entityType: 'todoList', where: DELETED_CLAUSE } as const;
    const unsubAll = c.subscribe.entities(listQuery, () => {});
    const unsub = c.subscribe.entities(
      { entityType: 'todoList', where: DELETED_CLAUSE, limit: 1 },
      () => {}
    );

    await c.poll();
    unsub();
    unsubAll();

    const all = await c.read([
      { entityType: 'todoList', where: DELETED_CLAUSE },
    ]);
    const entityIds = new Set((all[0]?.entities ?? []).map((e) => e.entityId));
    for (const id of lists) {
      expect(entityIds.has(id)).toBe(true);
    }

    await sim.assertConsistent(listQuery);
  });
});
