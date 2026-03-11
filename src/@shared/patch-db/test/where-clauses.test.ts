import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { PatchesDb } from '../interface';
import { implementations, whereClauseFixtures } from './test-helpers';

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

  describe('where clauses', () => {
    beforeEach(async () => {
      await db.write(whereClauseFixtures);
    });

    test('entities without filter returns all', async () => {
      const all = await db.readEntities({ entityType: 'item' });
      expect(all.data).toHaveLength(4);
    });

    test('entityId filter works', async () => {
      const result = await db.readEntities({
        entityType: 'item',
        entityId: 't1',
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].attributes.tag).toBe('a');
    });

    test('where = matches exact value', async () => {
      const result = await db.readEntities({
        entityType: 'item',
        where: { type: '=', attribute: 'tag', value: 'a' },
      });
      expect(result.data).toHaveLength(2);
      const ids = result.data.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t1', 't3']);
    });

    test('where != excludes matching value', async () => {
      const result = await db.readEntities({
        entityType: 'item',
        where: { type: '!=', attribute: 'tag', value: 'a' },
      });
      const ids = result.data.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t2']);
    });

    test('where in matches any of given values', async () => {
      const result = await db.readEntities({
        entityType: 'item',
        where: { type: 'in', attribute: 'score', values: [10, 30] },
      });
      const ids = result.data.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t1', 't3']);
    });

    test('where not_in excludes given values', async () => {
      const result = await db.readEntities({
        entityType: 'item',
        where: { type: 'not_in', attribute: 'score', values: [10, 30] },
      });
      const ids = result.data.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t2', 't4']);
    });

    test('where gt matches values greater than', async () => {
      const result = await db.readEntities({
        entityType: 'item',
        where: { type: 'gt', attribute: 'score', value: 20 },
      });
      const ids = result.data.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t3', 't4']);
    });

    test('where gte matches values greater than or equal', async () => {
      const result = await db.readEntities({
        entityType: 'item',
        where: { type: 'gte', attribute: 'score', value: 20 },
      });
      const ids = result.data.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t2', 't3', 't4']);
    });

    test('where lt matches values less than', async () => {
      const result = await db.readEntities({
        entityType: 'item',
        where: { type: 'lt', attribute: 'score', value: 20 },
      });
      const ids = result.data.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t1']);
    });

    test('where lte matches values less than or equal', async () => {
      const result = await db.readEntities({
        entityType: 'item',
        where: { type: 'lte', attribute: 'score', value: 20 },
      });
      const ids = result.data.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t1', 't2']);
    });

    test('where contains matches substring', async () => {
      const result = await db.readEntities({
        entityType: 'item',
        where: { type: 'contains', attribute: 'name', value: 'Gadget' },
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].entityId).toBe('t2');
    });

    test('where exists matches entities that have the attribute', async () => {
      const result = await db.readEntities({
        entityType: 'item',
        where: { type: 'exists', attribute: 'tag' },
      });
      const ids = result.data.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t1', 't2', 't3']);
    });

    test('where not_exists matches entities missing the attribute', async () => {
      const result = await db.readEntities({
        entityType: 'item',
        where: { type: 'not_exists', attribute: 'tag' },
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].entityId).toBe('t4');
    });

    test('where and requires all clauses to match', async () => {
      const result = await db.readEntities({
        entityType: 'item',
        where: {
          type: 'and',
          clauses: [
            { type: '=', attribute: 'tag', value: 'a' },
            { type: 'gt', attribute: 'score', value: 15 },
          ],
        },
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].entityId).toBe('t3');
    });

    test('where or requires any clause to match', async () => {
      const result = await db.readEntities({
        entityType: 'item',
        where: {
          type: 'or',
          clauses: [
            { type: '=', attribute: 'score', value: 10 },
            { type: '=', attribute: 'score', value: 40 },
          ],
        },
      });
      const ids = result.data.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t1', 't4']);
    });

    test('where not inverts the clause', async () => {
      const result = await db.readEntities({
        entityType: 'item',
        where: {
          type: 'not',
          clause: { type: '=', attribute: 'tag', value: 'a' },
        },
      });
      const ids = result.data.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t2']);
    });

    test('where not combined with exists covers missing attributes', async () => {
      const result = await db.readEntities({
        entityType: 'item',
        where: {
          type: 'or',
          clauses: [
            {
              type: 'not',
              clause: { type: '=', attribute: 'tag', value: 'a' },
            },
            { type: 'not_exists', attribute: 'tag' },
          ],
        },
      });
      const ids = result.data.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t2', 't4']);
    });
  });
});
