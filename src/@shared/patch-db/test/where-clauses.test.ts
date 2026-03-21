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
      const [all] = await db.read([{ entityType: 'item' }]);
      expect(all.entities).toHaveLength(4);
    });

    test('entityId filter works', async () => {
      const [result] = await db.read([{ entityType: 'item', entityId: 't1' }]);
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].attributes['item/tag']).toBe('a');
    });

    test('where = matches exact value', async () => {
      const [result] = await db.read([
        {
          entityType: 'item',
          where: { type: '=', attribute: 'item/tag', value: 'a' },
        },
      ]);
      expect(result.entities).toHaveLength(2);
      const ids = result.entities.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t1', 't3']);
    });

    test('where != excludes matching value', async () => {
      const [result] = await db.read([
        {
          entityType: 'item',
          where: { type: '!=', attribute: 'item/tag', value: 'a' },
        },
      ]);
      const ids = result.entities.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t2']);
    });

    test('where in matches any of given values', async () => {
      const [result] = await db.read([
        {
          entityType: 'item',
          where: { type: 'in', attribute: 'item/score', values: [10, 30] },
        },
      ]);
      const ids = result.entities.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t1', 't3']);
    });

    test('where not_in excludes given values', async () => {
      const [result] = await db.read([
        {
          entityType: 'item',
          where: { type: 'not_in', attribute: 'item/score', values: [10, 30] },
        },
      ]);
      const ids = result.entities.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t2', 't4']);
    });

    test('where gt matches values greater than', async () => {
      const [result] = await db.read([
        {
          entityType: 'item',
          where: { type: 'gt', attribute: 'item/score', value: 20 },
        },
      ]);
      const ids = result.entities.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t3', 't4']);
    });

    test('where gte matches values greater than or equal', async () => {
      const [result] = await db.read([
        {
          entityType: 'item',
          where: { type: 'gte', attribute: 'item/score', value: 20 },
        },
      ]);
      const ids = result.entities.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t2', 't3', 't4']);
    });

    test('where lt matches values less than', async () => {
      const [result] = await db.read([
        {
          entityType: 'item',
          where: { type: 'lt', attribute: 'item/score', value: 20 },
        },
      ]);
      const ids = result.entities.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t1']);
    });

    test('where lte matches values less than or equal', async () => {
      const [result] = await db.read([
        {
          entityType: 'item',
          where: { type: 'lte', attribute: 'item/score', value: 20 },
        },
      ]);
      const ids = result.entities.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t1', 't2']);
    });

    test('where contains matches substring', async () => {
      const [result] = await db.read([
        {
          entityType: 'item',
          where: { type: 'contains', attribute: 'item/name', value: 'Gadget' },
        },
      ]);
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].entityId).toBe('t2');
    });

    test('where exists matches entities that have the attribute', async () => {
      const [result] = await db.read([
        {
          entityType: 'item',
          where: { type: 'exists', attribute: 'item/tag' },
        },
      ]);
      const ids = result.entities.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t1', 't2', 't3']);
    });

    test('where not_exists matches entities missing the attribute', async () => {
      const [result] = await db.read([
        {
          entityType: 'item',
          where: { type: 'not_exists', attribute: 'item/tag' },
        },
      ]);
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].entityId).toBe('t4');
    });

    test('where and requires all clauses to match', async () => {
      const [result] = await db.read([
        {
          entityType: 'item',
          where: {
            type: 'and',
            clauses: [
              { type: '=', attribute: 'item/tag', value: 'a' },
              { type: 'gt', attribute: 'item/score', value: 15 },
            ],
          },
        },
      ]);
      expect(result.entities).toHaveLength(1);
      expect(result.entities[0].entityId).toBe('t3');
    });

    test('where or requires any clause to match', async () => {
      const [result] = await db.read([
        {
          entityType: 'item',
          where: {
            type: 'or',
            clauses: [
              { type: '=', attribute: 'item/score', value: 10 },
              { type: '=', attribute: 'item/score', value: 40 },
            ],
          },
        },
      ]);
      const ids = result.entities.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t1', 't4']);
    });

    test('where not inverts the clause', async () => {
      const [result] = await db.read([
        {
          entityType: 'item',
          where: {
            type: 'not',
            clause: { type: '=', attribute: 'item/tag', value: 'a' },
          },
        },
      ]);
      const ids = result.entities.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t2']);
    });

    test('where not combined with exists covers missing attributes', async () => {
      const [result] = await db.read([
        {
          entityType: 'item',
          where: {
            type: 'or',
            clauses: [
              {
                type: 'not',
                clause: { type: '=', attribute: 'item/tag', value: 'a' },
              },
              { type: 'not_exists', attribute: 'item/tag' },
            ],
          },
        },
      ]);
      const ids = result.entities.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t2', 't4']);
    });
  });
});
