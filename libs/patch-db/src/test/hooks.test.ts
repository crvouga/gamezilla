import { assert } from '@gamezilla/lib/assert';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { PatchesDb } from '../interface';
import { createSqliteFactory } from './test-helpers';

describe('PatchesDb hooks (sqlite)', () => {
  let db: PatchesDb;
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
});
