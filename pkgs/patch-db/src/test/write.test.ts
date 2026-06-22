import { assert } from '@pkgs/assert';
import { asKeyword } from '@pkgs/keyword';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { PatchDb } from '../interface';
import { PATCH_SYNCED_AT, toAttributeState } from '../interface';
import { implementations } from './test-helpers';

describe.each(implementations)('$name', ({ factory }) => {
  let db: PatchDb;
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
      attributes: toAttributeState({
        'task/title': 'Buy milk',
        'task/priority': 'low',
        'task/status': 'open',
      }),
    };

    const p2 = {
      entityId: 'e1',
      entityType: 'task',
      attributes: toAttributeState({
        'task/priority': 'high',
        'task/assignee': 'alice',
      }),
    };

    const p3 = {
      entityId: 'e1',
      entityType: 'task',
      attributes: toAttributeState({ 'task/priority': null }),
    };

    const w = await db.write([p1, p2, p3]);
    expect(w.rejected).toHaveLength(0);
    const written = w.accepted;
    expect(written).toHaveLength(3);

    const results = await db.read([{ entityType: 'task', entityId: 'e1' }]);
    const result = results[0];
    assert.defined(result, 'result must be defined');
    expect(result.patches).toHaveLength(3);

    const patch0 = result.patches[0];
    assert.defined(patch0, 'patch0 must be defined');
    const patch1 = result.patches[1];
    assert.defined(patch1, 'patch1 must be defined');
    const patch2 = result.patches[2];
    assert.defined(patch2, 'patch2 must be defined');
    const written0 = written[0];
    assert.defined(written0, 'written0 must be defined');
    const written1 = written[1];
    assert.defined(written1, 'written1 must be defined');
    expect(patch0.parentId).toBeNull();
    expect(patch1.parentId).toBe(written0.patchId);
    expect(patch2.parentId).toBe(written1.patchId);

    expect(patch0.createdAt).toBeDefined();
    expect(patch0.recordedAt).toBeDefined();
    expect(typeof patch0.createdAt).toBe('string');
    expect(typeof patch0.recordedAt).toBe('string');

    expect(result.entities).toHaveLength(1);
    const entity = result.entities[0];
    assert.defined(entity, 'entity must be defined');
    expect(entity.entityId).toBe('e1');
    expect(entity.entityType).toBe('task');
    expect(entity.attributes[asKeyword('task/title')]).toBe('Buy milk');
    expect(entity.attributes[asKeyword('task/assignee')]).toBe('alice');
    expect(entity.attributes[asKeyword('task/status')]).toBe('open');
    expect(entity.attributes).not.toHaveProperty('task/priority');
  });

  test('patches ordered by lineage, nextCursor is patchId for pagination', async () => {
    await db.write([
      {
        entityId: 'e2',
        entityType: 'task',
        attributes: toAttributeState({ 'task/seq': 1 }),
      },
      {
        entityId: 'e2',
        entityType: 'task',
        attributes: toAttributeState({ 'task/seq': 2 }),
      },
      {
        entityId: 'e2',
        entityType: 'task',
        attributes: toAttributeState({ 'task/seq': 3 }),
      },
    ]);

    const page1Results = await db.read([
      { entityType: 'task', entityId: 'e2', limit: 2 },
    ]);
    const page1 = page1Results[0];
    assert.defined(page1, 'page1 must be defined');
    expect(page1.patches).toHaveLength(2);
    const page1Last = page1.patches[1];
    assert.defined(page1Last, 'page1Last must be defined');
    expect(page1.nextCursor).toBe(page1Last.patchId);
    expect(page1.hasMore).toBe(true);

    const page1Cursor = page1.nextCursor;
    assert.defined(page1Cursor, 'page1Cursor must be defined');
    const page2Results = await db.read([
      {
        entityType: 'task',
        entityId: 'e2',
        limit: 10,
        after: page1Cursor,
      },
    ]);
    const page2 = page2Results[0];
    assert.defined(page2, 'page2 must be defined');
    expect(page2.patches).toHaveLength(1);
    const page2First = page2.patches[0];
    assert.defined(page2First, 'page2First must be defined');
    expect(page2First.attributes[asKeyword('task/seq')]).toBe(3);
    expect(page2.nextCursor).toBe(page2First.patchId);
    expect(page2.hasMore).toBe(false);
  });

  test('synced patches preserve parentId from client', async () => {
    const p1Written = await db.write([
      {
        entityId: 'e3',
        entityType: 'task',
        attributes: toAttributeState({ 'task/val': 1 }),
      },
      {
        entityId: 'e3',
        entityType: 'task',
        attributes: toAttributeState({ 'task/val': 2 }),
      },
    ]);
    expect(p1Written.rejected).toHaveLength(0);
    const p1 = p1Written.accepted[0];
    assert.defined(p1, 'p1 must be defined');
    const syncedP3 = {
      entityId: 'e3',
      entityType: 'task',
      attributes: toAttributeState({ 'task/val': 3 }),
      patchId: crypto.randomUUID(),
      parentId: p1.patchId,
      createdAt: new Date().toISOString(),
      recordedAt: new Date().toISOString(),
      createdBy: '',
      sessionId: '',
    };
    await db.write([syncedP3]);

    const readResults = await db.read([{ entityType: 'task', entityId: 'e3' }]);
    const result = readResults[0];
    assert.defined(result, 'result must be defined');
    const p3Read = result.patches.find((x) => x.patchId === syncedP3.patchId);
    expect(p3Read?.parentId).toBe(p1.patchId);
  });

  test('synced patch batch with out-of-order parent references does not violate FK', async () => {
    const root = await db.write([
      {
        entityId: 'e4',
        entityType: 'todo',
        attributes: toAttributeState({ 'todo/done': false }),
      },
    ]);
    expect(root.rejected).toHaveLength(0);
    const rootPatch = root.accepted[0];
    assert.defined(rootPatch, 'rootPatch must be defined');

    const idA = crypto.randomUUID();
    const idB = crypto.randomUUID();
    const idC = crypto.randomUUID();
    const idD = crypto.randomUUID();
    const idE = crypto.randomUUID();
    const now = new Date().toISOString();

    const makeSynced = (patchId: string, parentId: string, value: unknown) => ({
      entityId: 'e4',
      entityType: 'todo',
      attributes: toAttributeState({
        'todo/done': value,
        'patch/synced-at': null,
        'patch/created-by-id': '',
        'patch/session-id': '',
      }),
      patchId,
      parentId,
      createdAt: now,
      recordedAt: now,
      createdBy: '',
      sessionId: '',
    });

    // Chain: root -> A -> B -> C -> D -> E
    // Intentionally scrambled so children precede parents in the array.
    const patches = [
      makeSynced(idD, idC, false), // D before C
      makeSynced(idB, idA, false), // B before A
      makeSynced(idE, idD, true), // E before D
      makeSynced(idA, rootPatch.patchId, true), // A (first in chain)
      makeSynced(idC, idB, true), // C before B
    ];

    const writtenOut = await db.write(patches);
    expect(writtenOut.rejected).toHaveLength(0);
    const written = writtenOut.accepted;
    expect(written).toHaveLength(5);

    const results = await db.read([{ entityType: 'todo', entityId: 'e4' }]);
    const result = results[0];
    assert.defined(result, 'result must be defined');
    expect(result.patches).toHaveLength(6);

    const last = result.patches[result.patches.length - 1];
    assert.defined(last, 'last patch must be defined');
    expect(last.patchId).toBe(idE);
    expect(last.attributes[asKeyword('todo/done')]).toBe(true);
  });

  test('synced patch whose parentId is absent on server re-anchors to chain leaf', async () => {
    const chain = await db.write([
      {
        entityId: 'e7',
        entityType: 'todo',
        attributes: toAttributeState({ 'todo/num': 0 }),
      },
      {
        entityId: 'e7',
        entityType: 'todo',
        attributes: toAttributeState({ 'todo/num': 1 }),
      },
    ]);
    expect(chain.rejected).toHaveLength(0);
    const leaf = chain.accepted[1];
    assert.defined(leaf, 'leaf patch must be defined');
    const phantomParent = crypto.randomUUID();
    const childId = crypto.randomUUID();
    const now = new Date().toISOString();
    await db.write([
      {
        entityId: 'e7',
        entityType: 'todo',
        attributes: toAttributeState({
          'todo/num': 2,
          'patch/synced-at': null,
          'patch/created-by-id': '',
          'patch/session-id': '',
        }),
        patchId: childId,
        parentId: phantomParent,
        createdAt: now,
        recordedAt: now,
        createdBy: '',
        sessionId: '',
      },
    ]);

    const [readResult] = await db.read([
      { entityType: 'todo', entityId: 'e7' },
    ]);
    assert.defined(readResult, 'readResult must be defined');
    const child = readResult.patches.find((p) => p.patchId === childId);
    assert.defined(child, 'child patch must be defined');
    expect(child.parentId).toBe(leaf.patchId);
  });

  test('read with on:patches returns patches without patch/synced-at (unsynced)', async () => {
    const listId = crypto.randomUUID();
    const createWritten = await db.write([
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
    expect(createWritten.rejected).toHaveLength(0);
    const createPatch = createWritten.accepted[0];
    assert.defined(createPatch, 'createPatch must be defined');
    const deleteWritten = await db.write([
      {
        entityId: listId,
        entityType: 'todo-list',
        attributes: toAttributeState({ 'todo-list/deleted': true }),
      },
    ]);
    expect(deleteWritten.rejected).toHaveLength(0);
    const deletePatch = deleteWritten.accepted[0];
    assert.defined(deletePatch, 'deletePatch must be defined');

    const unsyncedResults = await db.read([
      {
        on: 'patches',
        where: {
          type: 'not_exists',
          attribute: PATCH_SYNCED_AT,
        },
      },
    ]);
    const result = unsyncedResults[0];
    assert.defined(result, 'result must be defined');
    const unsynced = result.patches;
    expect(unsynced).toHaveLength(2);
    expect(unsynced.map((p) => p.patchId)).toContain(createPatch.patchId);
    expect(unsynced.map((p) => p.patchId)).toContain(deletePatch.patchId);
    expect(
      unsynced.find((p) => p.patchId === deletePatch.patchId)?.attributes
    ).toMatchObject({ 'todo-list/deleted': true });

    await db.update(
      unsynced.map((p) => ({
        patchId: p.patchId,
        attributes: toAttributeState({ [PATCH_SYNCED_AT]: '1' }),
      }))
    );
    const afterSyncResults = await db.read([
      {
        on: 'patches',
        where: {
          type: 'not_exists',
          attribute: PATCH_SYNCED_AT,
        },
      },
    ]);
    const afterSync = afterSyncResults[0];
    assert.defined(afterSync, 'afterSync must be defined');
    expect(afterSync.patches).toHaveLength(0);
  });

  test('entity snapshot ignores patches marked sync-rejected', async () => {
    const entityId = 'e-rej';
    const w = await db.write([
      {
        entityId,
        entityType: 'task',
        attributes: toAttributeState({ 'task/title': 'Before reject' }),
      },
      {
        entityId,
        entityType: 'task',
        attributes: toAttributeState({ 'task/priority': 'high' }),
      },
    ]);
    expect(w.rejected).toHaveLength(0);
    const [, second] = w.accepted;
    assert.defined(second, 'second patch');
    await db.update([
      {
        patchId: second.patchId,
        attributes: toAttributeState({
          'patch/sync-rejected-at': new Date().toISOString(),
          'patch/sync-rejected-reason': 'forbidden: test',
          'patch/rejected': true,
        }),
      },
    ]);
    const [r] = await db.read([{ entityType: 'task', entityId }]);
    assert.defined(r, 'result');
    expect(r.entities).toHaveLength(1);
    const ent = r.entities[0];
    assert.defined(ent, 'entity');
    expect(ent.attributes[asKeyword('task/title')]).toBe('Before reject');
    expect(ent.attributes).not.toHaveProperty('task/priority');
  });
});
