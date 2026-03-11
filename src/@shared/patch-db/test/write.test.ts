import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { PatchesDb } from '../interface';
import { implementations } from './test-helpers';

describe.each(implementations)('$name', ({ name, factory }) => {
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
      attributes: { title: 'Buy milk', priority: 'low', status: 'open' },
    };

    const p2 = {
      entityId: 'e1',
      entityType: 'task',
      attributes: { priority: 'high', assignee: 'alice' },
    };

    const p3 = {
      entityId: 'e1',
      entityType: 'task',
      attributes: { priority: null },
    };

    const written = await db.write([p1, p2, p3]);
    expect(written).toHaveLength(3);

    const [result] = await db.readEntities([
      { entityType: 'task', entityId: 'e1' },
    ]);
    expect(result.patches).toHaveLength(3);
    expect(result.total).toBe(3);

    expect(result.patches[0].parentId).toBeNull();
    expect(result.patches[1].parentId).toBe(written[0].patchId);
    expect(result.patches[2].parentId).toBe(written[1].patchId);

    expect(result.patches[0].createdAt).toBeDefined();
    expect(result.patches[0].recordedAt).toBeDefined();
    expect(typeof result.patches[0].createdAt).toBe('string');
    expect(typeof result.patches[0].recordedAt).toBe('string');

    expect(result.entities).toHaveLength(1);
    const entity = result.entities[0];
    expect(entity.entityId).toBe('e1');
    expect(entity.entityType).toBe('task');
    expect(entity.attributes.title).toBe('Buy milk');
    expect(entity.attributes.assignee).toBe('alice');
    expect(entity.attributes.status).toBe('open');
    expect(entity.attributes).not.toHaveProperty('priority');
  });

  test('patches ordered by lineage, nextCursor is patchId for pagination', async () => {
    await db.write([
      { entityId: 'e2', entityType: 'task', attributes: { x: 1 } },
      { entityId: 'e2', entityType: 'task', attributes: { x: 2 } },
      { entityId: 'e2', entityType: 'task', attributes: { x: 3 } },
    ]);

    const [page1] = await db.readEntities([
      { entityType: 'task', entityId: 'e2', limit: 2 },
    ]);
    expect(page1.patches).toHaveLength(2);
    expect(page1.nextCursor).toBe(page1.patches[1].patchId);
    expect(page1.hasMore).toBe(true);

    const [page2] = await db.readEntities([
      {
        entityType: 'task',
        entityId: 'e2',
        limit: 10,
        after: page1.nextCursor!,
      },
    ]);
    expect(page2.patches).toHaveLength(1);
    expect(page2.patches[0].attributes.x).toBe(3);
    expect(page2.nextCursor).toBe(page2.patches[0].patchId);
    expect(page2.hasMore).toBe(false);
  });

  test('synced patches preserve parentId from client', async () => {
    const [p1] = await db.write([
      { entityId: 'e3', entityType: 'task', attributes: { a: 1 } },
      { entityId: 'e3', entityType: 'task', attributes: { a: 2 } },
    ]);
    const syncedP3 = {
      entityId: 'e3',
      entityType: 'task',
      attributes: { a: 3 },
      patchId: crypto.randomUUID(),
      parentId: p1.patchId,
      createdAt: new Date().toISOString(),
      recordedAt: new Date().toISOString(),
      createdBy: '',
      sessionId: '',
    };
    await db.write([syncedP3]);

    const [result] = await db.readEntities([
      { entityType: 'task', entityId: 'e3' },
    ]);
    const p3Read = result.patches.find((x) => x.patchId === syncedP3.patchId);
    expect(p3Read?.parentId).toBe(p1.patchId);
  });

  test('read with where source metadata returns patches without syncedAt (unsynced)', async () => {
    const listId = crypto.randomUUID();
    const [createPatch] = await db.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: {
          name: 'My List',
          order: 0,
          createdAt: new Date().toISOString(),
        },
      },
    ]);
    const [deletePatch] = await db.write([
      {
        entityId: listId,
        entityType: 'todoList',
        attributes: { deleted: true },
      },
    ]);

    const [result] = await db.readEntities([
      {
        where: {
          type: 'not_exists',
          attribute: 'syncedAt',
          source: 'metadata',
        },
      },
    ]);
    const unsynced = result.patches;
    expect(unsynced).toHaveLength(2);
    expect(unsynced.map((p) => p.patchId)).toContain(createPatch.patchId);
    expect(unsynced.map((p) => p.patchId)).toContain(deletePatch.patchId);
    expect(
      unsynced.find((p) => p.patchId === deletePatch.patchId)?.attributes
    ).toEqual({ deleted: true });

    await db.updateMetadata(
      unsynced.map((p) => ({ patchId: p.patchId, metadata: { syncedAt: '1' } }))
    );
    const [afterSync] = await db.readEntities([
      {
        where: {
          type: 'not_exists',
          attribute: 'syncedAt',
          source: 'metadata',
        },
      },
    ]);
    expect(afterSync.patches).toHaveLength(0);
  });
});
