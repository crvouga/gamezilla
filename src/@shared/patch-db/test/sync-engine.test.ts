import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { Patch, PatchesDbQuery } from '../interface';
import { createSyncDbFactory, expectDefined } from './test-helpers';

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

    const remoteResult = expectDefined(
      (
        await syncDb.remote.read([
          { entityType: 'todoList', entityId: listId },
        ])
      )[0]
    );
    expect(remoteResult.patches).toHaveLength(1);
    expect(expectDefined(remoteResult.patches[0]).attributes).toMatchObject({
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

    const remoteResult = expectDefined(
      (
        await syncDb.remote.read([
          { entityType: 'todoList', entityId: listId },
        ])
      )[0]
    );
    expect(remoteResult.patches).toHaveLength(2);
    const deletePatch = remoteResult.patches.find(
      (p) =>
        p.attributes &&
        'todoList/deleted' in p.attributes &&
        (p.attributes as { 'todoList/deleted': boolean })[
          'todoList/deleted'
        ] === true
    );
    const patch = expectDefined(deletePatch);
    expect(patch.attributes).toEqual({ 'todoList/deleted': true });
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

    const r1 = expectDefined(
      (await syncDb.remote.read([{ entityType: 'todoList', entityId: listId1 }]))[0]
    );
    const r2 = expectDefined(
      (await syncDb.remote.read([{ entityType: 'todoList', entityId: listId2 }]))[0]
    );
    expect(r1.patches).toHaveLength(1);
    expect(r2.patches).toHaveLength(1);
    expect(expectDefined(r1.patches[0]).attributes).toMatchObject({
      'todoList/name': 'List 1',
    });
    expect(expectDefined(r2.patches[0]).attributes).toMatchObject({
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
    const last = received[received.length - 1] as {
      entityId: string;
      attributes: Record<string, unknown>;
    }[];
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

    const entitiesResult = expectDefined(
      (
        await syncDb.syncDb.read([
          { entityType: 'todoList', entityId: listId },
        ])
      )[0]
    );
    const entity = entitiesResult.entities[0];
    expect(entity).toBeDefined();
    expect(entity?.attributes?.['todoList/deleted']).toBe(true);
  });

  test('poll: sibling patch from another client is not missed when its patchId sorts before cursor', async () => {
    const entityId = crypto.randomUUID();
    const entityType = 'task';

    // 1. Write root patch on remote (simulates shared initial state)
    const rootPatch = expectDefined(
      (
        await syncDb.remote.write([
          { entityId, entityType, attributes: { 'task/title': 'Root' } },
        ])
      )[0]
    );

    // 2. Subscribe so the sync engine registers an active query, then poll
    const unsub = syncDb.syncDb.subscribe.entities(
      { entityType, entityId },
      () => {}
    );
    syncDb.invalidateRemote();
    await new Promise((r) => setTimeout(r, 50));

    // Verify client got the root patch
    const localAfterFirstPoll = expectDefined(
      (await syncDb.local.read([{ entityType, entityId }]))[0]
    );
    expect(localAfterFirstPoll.patches).toHaveLength(1);

    // 3. Client writes a local patch (depth 1, parent = root)
    const clientAPatch = expectDefined(
      (
        await syncDb.syncDb.write([
          { entityId, entityType, attributes: { 'task/status': 'in-progress' } },
        ])
      )[0]
    );

    // Wait for push timer to sync it to remote
    await new Promise((r) => setTimeout(r, 100));
    const remoteAfterPush = expectDefined(
      (await syncDb.remote.read([{ entityType, entityId }]))[0]
    );
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
    const remoteAll = expectDefined(
      (await syncDb.remote.read([{ entityType, entityId }]))[0]
    );
    expect(remoteAll.patches).toHaveLength(3);

    // 5. Client polls again — should bring in the sibling patch
    syncDb.invalidateRemote();
    await new Promise((r) => setTimeout(r, 50));

    // 6. Verify local has all 3 patches
    const finalLocal = expectDefined(
      (await syncDb.local.read([{ entityType, entityId }]))[0]
    );
    unsub();

    const hasSiblingPatch = finalLocal.patches.some(
      (p) => p.patchId === siblingPatchId
    );
    expect(hasSiblingPatch).toBe(true);
    expect(finalLocal.patches).toHaveLength(3);
  });
});
