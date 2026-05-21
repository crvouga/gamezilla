import { assert } from '@gamezilla/assert';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  PATCH_REJECT_CODE,
  toAttributeState,
  type PatchDb,
  type PatchRejectionReason,
} from '../interface';
import { createSqliteFactory } from './test-helpers';

describe('PatchDb hooks (sqlite)', () => {
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

  test('beforeRead can narrow results (limit)', async () => {
    db.hooks.beforeRead((q) => ({ ...q, limit: 1 }));
    await db.write([
      {
        entityId: 'h1',
        entityType: 'hook-task',
        attributes: toAttributeState({ 'hook-task/num': 1 }),
      },
      {
        entityId: 'h2',
        entityType: 'hook-task',
        attributes: toAttributeState({ 'hook-task/num': 2 }),
      },
    ]);
    const [r] = await db.read([{ entityType: 'hook-task' }]);
    assert.defined(r, 'result');
    expect(r.entities.length).toBe(1);
  });

  test('beforeWrite throw prevents persistence', async () => {
    db.hooks.beforeWrite((_patches, _ctx, _tx) => {
      throw new Error('abort write');
    });
    await expect(
      db.write([
        {
          entityId: 'x',
          entityType: 'hook-abort',
          attributes: toAttributeState({ 'hook-abort/val': 1 }),
        },
      ])
    ).rejects.toThrow('abort write');
    const [r] = await db.read([{ entityType: 'hook-abort', entityId: 'x' }]);
    assert.defined(r, 'result');
    expect(r.entities.length).toBe(0);
  });

  test('beforeWrite can partition into accepted and rejected', async () => {
    const idKeep = crypto.randomUUID();
    const idDrop = crypto.randomUUID();
    db.hooks.beforeWrite(async (patches, _ctx, _tx) => {
      const accepted: typeof patches = [];
      const rejected: PatchRejectionReason[] = [];
      for (const p of patches) {
        if (p.entityType === 'hook-drop') {
          rejected.push({
            patchId: p.patchId!,
            code: PATCH_REJECT_CODE.hook1.key,
            reason: 'dropped by hook1',
          });
        } else {
          accepted.push(p);
        }
      }
      return { accepted, rejected };
    });
    const out = await db.write([
      {
        patchId: idKeep,
        entityId: 'e-keep',
        entityType: 'hook-keep',
        attributes: toAttributeState({ 'hook-keep/num': 1 }),
      },
      {
        patchId: idDrop,
        entityId: 'e-drop',
        entityType: 'hook-drop',
        attributes: toAttributeState({ 'hook-drop/num': 2 }),
      },
    ]);
    expect(out.rejected.some((r) => r.patchId === idDrop)).toBe(true);
    expect(out.accepted).toHaveLength(1);
    expect(out.accepted[0]?.patchId).toBe(idKeep);
    const [dropRead] = await db.read([
      { entityType: 'hook-drop', entityId: 'e-drop' },
    ]);
    assert.defined(dropRead, 'dropRead');
    expect(dropRead.entities).toHaveLength(0);
    const [keepRead] = await db.read([
      { entityType: 'hook-keep', entityId: 'e-keep' },
    ]);
    assert.defined(keepRead, 'keepRead');
    expect(keepRead.entities).toHaveLength(1);
  });
});
