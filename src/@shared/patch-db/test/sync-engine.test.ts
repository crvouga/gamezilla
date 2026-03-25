import { assert } from '@/@shared/assert';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { assertEntity, type Patch, type PatchesDbQuery } from '../interface';
import { createSyncDbFactory } from './test-helpers';

const PUSH_WAIT_MS = 100;

const DELETED_CLAUSE: PatchesDbQuery['where'] = {
  type: 'or',
  clauses: [
    { type: 'not_exists', attribute: 'todoList/deleted' },
    { type: '=', attribute: 'todoList/deleted', value: false },
  ],
};

describe('SyncPatchesDb', () => {
  let syncDb: Awaited<ReturnType<typeof createSyncDbFactory>>;

  beforeEach(async () => {
    syncDb = await createSyncDbFactory();
  });

  afterEach(async () => {
    await syncDb.teardown();
  });

  test('push: create patch is pushed to remote', async () => {
    const listId = crypto.randomUUID();
    await syncDb.syncDb.write([
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

    await new Promise((r) => setTimeout(r, PUSH_WAIT_MS));

    const remoteResults = await syncDb.remote.read([
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
    const listId = crypto.randomUUID();
    await syncDb.syncDb.write([
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

    await new Promise((r) => setTimeout(r, PUSH_WAIT_MS));

    await syncDb.syncDb.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: { 'todoList/deleted': true },
      },
    ]);

    await new Promise((r) => setTimeout(r, PUSH_WAIT_MS));

    const remoteResults = await syncDb.remote.read([
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
    const listId1 = crypto.randomUUID();
    const listId2 = crypto.randomUUID();
    await syncDb.syncDb.write([
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

    await new Promise((r) => setTimeout(r, PUSH_WAIT_MS));

    const r1Results = await syncDb.remote.read([
      { entityType: 'todoList', entityId: listId1 },
    ]);
    const r1 = r1Results[0];
    assert.defined(r1, 'r1 must be defined');
    const r2Results = await syncDb.remote.read([
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
    const listId = crypto.randomUUID();
    await syncDb.remote.write([
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
    const unsub = syncDb.syncDb.subscribe.entities(
      { entityType: 'todoList', where: DELETED_CLAUSE },
      (result) => {
        received.push(result.entities);
      }
    );

    syncDb.invalidateRemote();
    await new Promise((r) => setTimeout(r, 0));

    unsub();

    expect(received.length).toBeGreaterThanOrEqual(1);
    const last = received[received.length - 1];
    assert.all(last, assertEntity);
    expect(
      last.some(
        (e) =>
          e.entityId === listId &&
          e.attributes?.['todoList/name'] === 'From Remote'
      )
    ).toBe(true);
  });

  test('poll: patches for deleted entities are fetched via tracked-entities query', async () => {
    const listId = crypto.randomUUID();
    await syncDb.remote.write([
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
    const unsub = syncDb.syncDb.subscribe.entities(
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

    syncDb.invalidateRemote();
    await new Promise((r) => setTimeout(r, 0));

    expect(received.some((r) => r.some((e) => e.entityId === listId))).toBe(
      true
    );

    await syncDb.remote.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: { 'todoList/deleted': true },
      },
    ]);

    syncDb.invalidateRemote();
    await new Promise((r) => setTimeout(r, 0));

    unsub();

    const entitiesResults = await syncDb.syncDb.read([
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
    const entityId = crypto.randomUUID();
    const entityType = 'task';

    // 1. Write root patch on remote (simulates shared initial state)
    const rootWritten = await syncDb.remote.write([
      { entityId, entityType, attributes: { 'task/title': 'Root' } },
    ]);
    const rootPatch = rootWritten[0];
    assert.defined(rootPatch, 'rootPatch must be defined');

    // 2. Subscribe so the sync engine registers an active query, then poll
    const unsub = syncDb.syncDb.subscribe.entities(
      { entityType, entityId },
      () => {}
    );
    syncDb.invalidateRemote();
    await new Promise((r) => setTimeout(r, 50));

    // Verify client got the root patch
    const localResults = await syncDb.local.read([{ entityType, entityId }]);
    const localAfterFirstPoll = localResults[0];
    assert.defined(localAfterFirstPoll, 'localAfterFirstPoll must be defined');
    expect(localAfterFirstPoll.patches).toHaveLength(1);

    // 3. Client writes a local patch (depth 1, parent = root)
    const clientAWritten = await syncDb.syncDb.write([
      { entityId, entityType, attributes: { 'task/status': 'in-progress' } },
    ]);
    const clientAPatch = clientAWritten[0];
    assert.defined(clientAPatch, 'clientAPatch must be defined');

    // Wait for push timer to sync it to remote
    await new Promise((r) => setTimeout(r, 100));
    const remoteAfterPushResults = await syncDb.remote.read([
      { entityType, entityId },
    ]);
    const remoteAfterPush = remoteAfterPushResults[0];
    assert.defined(remoteAfterPush, 'remoteAfterPush must be defined');
    expect(remoteAfterPush.patches).toHaveLength(2);

    // 4. Another client writes a sibling patch directly to remote (same parent,
    //    same depth) with a patchId that sorts BEFORE clientAPatch.patchId.
    //    This simulates a concurrent write from a different device.
    const siblingPatchId = '00000000-0000-0000-0000-000000000000';
    expect(siblingPatchId < clientAPatch.patchId).toBe(true);

    await syncDb.remote.write([
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

    // Verify remote has all 3 patches
    const remoteAllResults = await syncDb.remote.read([
      { entityType, entityId },
    ]);
    const remoteAll = remoteAllResults[0];
    assert.defined(remoteAll, 'remoteAll must be defined');
    expect(remoteAll.patches).toHaveLength(3);

    // 5. Client polls again — should bring in the sibling patch
    syncDb.invalidateRemote();
    await new Promise((r) => setTimeout(r, 50));

    // 6. Verify local has all 3 patches
    const finalLocalResults = await syncDb.local.read([
      { entityType, entityId },
    ]);
    const finalLocal = finalLocalResults[0];
    assert.defined(finalLocal, 'finalLocal must be defined');
    unsub();

    const hasSiblingPatch = finalLocal.patches.some(
      (p) => p.patchId === siblingPatchId
    );
    expect(hasSiblingPatch).toBe(true);
    expect(finalLocal.patches).toHaveLength(3);
  });
});
