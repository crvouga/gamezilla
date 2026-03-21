import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { PatchesDb } from '../interface';
import { expectDefined, implementations } from './test-helpers';

describe.each(implementations)('$name', ({ factory }) => {
  let db: PatchesDb;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const result = await factory();
    db = result.db;
    teardown = result.teardown;
  });

  afterEach(async () => {
    if (teardown) await teardown();
  });

  test('write patches, merge into entity, null deletes attribute, parentId is auto-populated', async () => {
    const p1 = {
      entityId: 'e1',
      entityType: 'task',
      attributes: {
        'task/title': 'Buy milk',
        'task/priority': 'low',
        'task/status': 'open',
      },
    };

    const p2 = {
      entityId: 'e1',
      entityType: 'task',
      attributes: { 'task/priority': 'high', 'task/assignee': 'alice' },
    };

    const p3 = {
      entityId: 'e1',
      entityType: 'task',
      attributes: { 'task/priority': null },
    };

    const written = await db.write([p1, p2, p3]);
    expect(written).toHaveLength(3);

    const result = expectDefined(
      (await db.read([{ entityType: 'task', entityId: 'e1' }]))[0]
    );
    expect(result.patches).toHaveLength(3);
    expect(result.total).toBe(3);

    const patch0 = expectDefined(result.patches[0]);
    const patch1 = expectDefined(result.patches[1]);
    const patch2 = expectDefined(result.patches[2]);
    const written0 = expectDefined(written[0]);
    const written1 = expectDefined(written[1]);
    expect(patch0.parentId).toBeNull();
    expect(patch1.parentId).toBe(written0.patchId);
    expect(patch2.parentId).toBe(written1.patchId);

    expect(patch0.createdAt).toBeDefined();
    expect(patch0.recordedAt).toBeDefined();
    expect(typeof patch0.createdAt).toBe('string');
    expect(typeof patch0.recordedAt).toBe('string');

    expect(result.entities).toHaveLength(1);
    const entity = expectDefined(result.entities[0]);
    expect(entity.entityId).toBe('e1');
    expect(entity.entityType).toBe('task');
    expect(entity.attributes['task/title']).toBe('Buy milk');
    expect(entity.attributes['task/assignee']).toBe('alice');
    expect(entity.attributes['task/status']).toBe('open');
    expect(entity.attributes).not.toHaveProperty('task/priority');
  });

  test('patches ordered by lineage, nextCursor is patchId for pagination', async () => {
    await db.write([
      { entityId: 'e2', entityType: 'task', attributes: { 'task/x': 1 } },
      { entityId: 'e2', entityType: 'task', attributes: { 'task/x': 2 } },
      { entityId: 'e2', entityType: 'task', attributes: { 'task/x': 3 } },
    ]);

    const page1 = expectDefined(
      (await db.read([{ entityType: 'task', entityId: 'e2', limit: 2 }]))[0]
    );
    expect(page1.patches).toHaveLength(2);
    const page1Last = expectDefined(page1.patches[1]);
    expect(page1.nextCursor).toBe(page1Last.patchId);
    expect(page1.hasMore).toBe(true);

    const page1Cursor = expectDefined(page1.nextCursor);
    const page2 = expectDefined(
      (
        await db.read([
          {
            entityType: 'task',
            entityId: 'e2',
            limit: 10,
            after: page1Cursor,
          },
        ])
      )[0]
    );
    expect(page2.patches).toHaveLength(1);
    const page2First = expectDefined(page2.patches[0]);
    expect(page2First.attributes['task/x']).toBe(3);
    expect(page2.nextCursor).toBe(page2First.patchId);
    expect(page2.hasMore).toBe(false);
  });

  test('synced patches preserve parentId from client', async () => {
    const p1 = expectDefined(
      (
        await db.write([
          { entityId: 'e3', entityType: 'task', attributes: { 'task/a': 1 } },
          { entityId: 'e3', entityType: 'task', attributes: { 'task/a': 2 } },
        ])
      )[0]
    );
    const syncedP3 = {
      entityId: 'e3',
      entityType: 'task',
      attributes: { 'task/a': 3 },
      patchId: crypto.randomUUID(),
      parentId: p1.patchId,
      createdAt: new Date().toISOString(),
      recordedAt: new Date().toISOString(),
      createdBy: '',
      sessionId: '',
    };
    await db.write([syncedP3]);

    const result = expectDefined(
      (await db.read([{ entityType: 'task', entityId: 'e3' }]))[0]
    );
    const p3Read = result.patches.find((x) => x.patchId === syncedP3.patchId);
    expect(p3Read?.parentId).toBe(p1.patchId);
  });

  test('read with on:patches returns patches without patch/syncedAt (unsynced)', async () => {
    const listId = crypto.randomUUID();
    const createPatch = expectDefined(
      (
        await db.write([
          {
            entityId: listId,
            entityType: 'todoList',
            attributes: {
              'todoList/name': 'My List',
              'todoList/order': 0,
              'todoList/createdAt': new Date().toISOString(),
            },
          },
        ])
      )[0]
    );
    const deletePatch = expectDefined(
      (
        await db.write([
          {
            entityId: listId,
            entityType: 'todoList',
            attributes: { 'todoList/deleted': true },
          },
        ])
      )[0]
    );

    const result = expectDefined(
      (
        await db.read([
          {
            on: 'patches',
            where: {
              type: 'not_exists',
              attribute: 'patch/syncedAt',
            },
          },
        ])
      )[0]
    );
    const unsynced = result.patches;
    expect(unsynced).toHaveLength(2);
    expect(unsynced.map((p) => p.patchId)).toContain(createPatch.patchId);
    expect(unsynced.map((p) => p.patchId)).toContain(deletePatch.patchId);
    expect(
      unsynced.find((p) => p.patchId === deletePatch.patchId)?.attributes
    ).toEqual({ 'todoList/deleted': true });

    await db.update(
      unsynced.map((p) => ({
        patchId: p.patchId,
        attributes: { 'patch/syncedAt': '1' },
      }))
    );
    const afterSync = expectDefined(
      (
        await db.read([
          {
            on: 'patches',
            where: {
              type: 'not_exists',
              attribute: 'patch/syncedAt',
            },
          },
        ])
      )[0]
    );
    expect(afterSync.patches).toHaveLength(0);
  });
});
