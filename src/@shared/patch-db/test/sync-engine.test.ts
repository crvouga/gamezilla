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
});
