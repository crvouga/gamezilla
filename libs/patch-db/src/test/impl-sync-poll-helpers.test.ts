import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { markMissingSyncedPatchesOnLocal } from '../impl-sync/impl-sync-poll-helpers';
import type { PatchDb, PatchDbQuery, PatchDbResult } from '../interface';
import { createSqliteFactory } from './test-helpers';

function emptyPatchResult(
  query: PatchDbQuery,
  patches: PatchDbResult['patches']
): PatchDbResult {
  return {
    query,
    entities: [],
    patches,
    total: patches.length,
    hasMore: false,
    nextCursor: null,
  };
}

describe('markMissingSyncedPatchesOnLocal', () => {
  let db: PatchDb;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const r = await createSqliteFactory();
    db = r.db;
    teardown = r.teardown;
  });

  afterEach(async () => {
    await teardown();
  });

  test('does not unsync when server returns patches but omits local ids (compaction)', async () => {
    const entityId = '00000000-0000-4000-8000-00000000aa01';
    const w = await db.write([
      {
        entityId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'A',
          'todoList/order': 0,
          'todoList/createdAt': new Date(0).toISOString(),
        },
      },
    ]);
    expect(w.rejected).toHaveLength(0);
    const localPatchId = w.accepted[0]!.patchId;
    await db.update([
      {
        patchId: localPatchId,
        attributes: { 'patch/syncedAt': '1' },
      },
    ]);
    const [localRead] = await db.read([{ entityType: 'todoList', entityId }]);
    expect(localRead?.patches.length).toBe(1);

    const serverOnlyId = '00000000-0000-4000-8000-00000000bbbb';
    const serverPatch = {
      patchId: serverOnlyId,
      entityId,
      entityType: 'todoList',
      attributes: { 'todoList/name': 'B' },
      parentId: null,
      createdAt: new Date().toISOString(),
      recordedAt: new Date().toISOString(),
      createdBy: '',
      sessionId: '',
    };
    const queries = [
      {
        entityType: 'todoList' as const,
        entityId,
        knownPatches: localRead!.patches,
      },
    ];
    const q0 = queries[0]!;
    const results = [emptyPatchResult(q0, [serverPatch])];

    await markMissingSyncedPatchesOnLocal(db, queries, results);

    const [after] = await db.read([{ entityType: 'todoList', entityId }]);
    const p = after?.patches.find((x) => x.patchId === localPatchId);
    expect(p?.attributes['patch/syncedAt']).toBe('1');
  });

  test('batched entities: unsyncs only entities with zero server patches', async () => {
    const entityX = '00000000-0000-4000-8000-00000000dd01';
    const entityY = '00000000-0000-4000-8000-00000000dd02';
    const wx = await db.write([
      {
        entityId: entityX,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'X',
          'todoList/order': 0,
          'todoList/createdAt': new Date(0).toISOString(),
        },
      },
    ]);
    const wy = await db.write([
      {
        entityId: entityY,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'Y',
          'todoList/order': 1,
          'todoList/createdAt': new Date(0).toISOString(),
        },
      },
    ]);
    const idX = wx.accepted[0]!.patchId;
    const idY = wy.accepted[0]!.patchId;
    await db.update([
      { patchId: idX, attributes: { 'patch/syncedAt': '1' } },
      { patchId: idY, attributes: { 'patch/syncedAt': '1' } },
    ]);
    const [localRead] = await db.read([
      { entityType: 'todoList', entityId: [entityX, entityY] },
    ]);
    expect(localRead?.patches.length).toBe(2);

    const serverOnlyY = '00000000-0000-4000-8000-00000000eeee';
    const serverPatchY = {
      patchId: serverOnlyY,
      entityId: entityY,
      entityType: 'todoList',
      attributes: { 'todoList/name': 'Y2' },
      parentId: null,
      createdAt: new Date().toISOString(),
      recordedAt: new Date().toISOString(),
      createdBy: '',
      sessionId: '',
    };
    const queries = [
      {
        entityType: 'todoList' as const,
        entityId: [entityX, entityY] as [string, string],
        knownPatches: localRead!.patches,
      },
    ];
    const q0 = queries[0]!;
    const results = [emptyPatchResult(q0, [serverPatchY])];

    await markMissingSyncedPatchesOnLocal(db, queries, results);

    const [after] = await db.read([
      { entityType: 'todoList', entityId: [entityX, entityY] },
    ]);
    const px = after?.patches.find((p) => p.patchId === idX);
    const py = after?.patches.find((p) => p.patchId === idY);
    expect(px?.attributes['patch/syncedAt']).toBeNull();
    expect(py?.attributes['patch/syncedAt']).toBe('1');
  });

  test('unsyncs when server returns no patches (wipe)', async () => {
    const entityId = '00000000-0000-4000-8000-00000000cc02';
    const w = await db.write([
      {
        entityId,
        entityType: 'todoList',
        attributes: {
          'todoList/name': 'W',
          'todoList/order': 0,
          'todoList/createdAt': new Date(0).toISOString(),
        },
      },
    ]);
    const localPatchId = w.accepted[0]!.patchId;
    await db.update([
      {
        patchId: localPatchId,
        attributes: { 'patch/syncedAt': '1' },
      },
    ]);
    const [localRead] = await db.read([{ entityType: 'todoList', entityId }]);

    const queries = [
      {
        entityType: 'todoList' as const,
        entityId,
        knownPatches: localRead!.patches,
      },
    ];
    const q0 = queries[0]!;
    const results = [emptyPatchResult(q0, [])];

    await markMissingSyncedPatchesOnLocal(db, queries, results);

    const [after] = await db.read([{ entityType: 'todoList', entityId }]);
    const p = after?.patches.find((x) => x.patchId === localPatchId);
    expect(
      p?.attributes['patch/syncedAt'] === null ||
        p?.attributes['patch/syncedAt'] === undefined
    ).toBe(true);
  });
});
