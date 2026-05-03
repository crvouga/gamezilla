import { assert } from '@gamezilla/lib/assert';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { PatchDb } from '../interface';
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
        entityType: 'hookTask',
        attributes: { 'hookTask/n': 1 },
      },
      {
        entityId: 'h2',
        entityType: 'hookTask',
        attributes: { 'hookTask/n': 2 },
      },
    ]);
    const [r] = await db.read([{ entityType: 'hookTask' }]);
    assert.defined(r, 'result');
    expect(r.entities.length).toBe(1);
  });

  test('beforeWrite throw prevents persistence', async () => {
    db.hooks.beforeWrite(() => {
      throw new Error('abort write');
    });
    await expect(
      db.write([
        {
          entityId: 'x',
          entityType: 'hookAbort',
          attributes: { 'hookAbort/a': 1 },
        },
      ])
    ).rejects.toThrow('abort write');
    const [r] = await db.read([{ entityType: 'hookAbort', entityId: 'x' }]);
    assert.defined(r, 'result');
    expect(r.entities.length).toBe(0);
  });

  test('beforeWrite can partition into accepted and rejected', async () => {
    const idKeep = crypto.randomUUID();
    const idDrop = crypto.randomUUID();
    db.hooks.beforeWrite(async (patches) => {
      const accepted: typeof patches = [];
      const rejected: {
        patchId: string;
        code: string;
        reason: string;
      }[] = [];
      for (const p of patches) {
        if (p.entityType === 'hookDrop') {
          rejected.push({
            patchId: p.patchId!,
            code: 'hook1',
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
        entityType: 'hookKeep',
        attributes: { 'hookKeep/n': 1 },
      },
      {
        patchId: idDrop,
        entityId: 'e-drop',
        entityType: 'hookDrop',
        attributes: { 'hookDrop/n': 2 },
      },
    ]);
    expect(out.rejected.some((r) => r.patchId === idDrop)).toBe(true);
    expect(out.accepted).toHaveLength(1);
    expect(out.accepted[0]?.patchId).toBe(idKeep);
    const [dropRead] = await db.read([
      { entityType: 'hookDrop', entityId: 'e-drop' },
    ]);
    assert.defined(dropRead, 'dropRead');
    expect(dropRead.entities).toHaveLength(0);
    const [keepRead] = await db.read([
      { entityType: 'hookKeep', entityId: 'e-keep' },
    ]);
    assert.defined(keepRead, 'keepRead');
    expect(keepRead.entities).toHaveLength(1);
  });
});
