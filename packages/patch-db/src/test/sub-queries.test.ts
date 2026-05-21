import { assert } from '@gamezilla/assert';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { PatchDb } from '../interface';
import { QItem } from './query-test-attrs';
import { implementations, whereClauseFixtures } from './test-helpers';

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

  describe('where clauses', () => {
    beforeEach(async () => {
      await db.write(whereClauseFixtures);
    });

    test('entities without filter returns all', async () => {
      const results = await db.read([{ entityType: 'item' }]);
      const all = results[0];
      assert.defined(all, 'all must be defined');
      expect(all.entities).toHaveLength(4);
    });

    test('entityId filter works', async () => {
      const results = await db.read([{ entityType: 'item', entityId: 't1' }]);
      const result = results[0];
      assert.defined(result, 'result must be defined');
      expect(result.entities).toHaveLength(1);
      const entity = result.entities[0];
      assert.defined(entity, 'entity must be defined');
      expect(entity.attributes[QItem.tag.key]).toBe('a');
    });

    test('where = matches exact value', async () => {
      const results = await db.read([
        {
          entityType: 'item',
          where: { type: '=', attribute: QItem.tag.key, value: 'a' },
        },
      ]);
      const result = results[0];
      assert.defined(result, 'result must be defined');
      expect(result.entities).toHaveLength(2);
      const ids = result.entities.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t1', 't3']);
    });

    test('where != excludes matching value', async () => {
      const results = await db.read([
        {
          entityType: 'item',
          where: { type: '!=', attribute: QItem.tag.key, value: 'a' },
        },
      ]);
      const result = results[0];
      assert.defined(result, 'result must be defined');
      const ids = result.entities.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t2']);
    });

    test('where in matches any of given values', async () => {
      const results = await db.read([
        {
          entityType: 'item',
          where: { type: 'in', attribute: QItem.score.key, values: [10, 30] },
        },
      ]);
      const result = results[0];
      assert.defined(result, 'result must be defined');
      const ids = result.entities.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t1', 't3']);
    });

    test('where not_in excludes given values', async () => {
      const results = await db.read([
        {
          entityType: 'item',
          where: {
            type: 'not_in',
            attribute: QItem.score.key,
            values: [10, 30],
          },
        },
      ]);
      const result = results[0];
      assert.defined(result, 'result must be defined');
      const ids = result.entities.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t2', 't4']);
    });

    test('where gt matches values greater than', async () => {
      const results = await db.read([
        {
          entityType: 'item',
          where: { type: 'gt', attribute: QItem.score.key, value: 20 },
        },
      ]);
      const result = results[0];
      assert.defined(result, 'result must be defined');
      const ids = result.entities.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t3', 't4']);
    });

    test('where gte matches values greater than or equal', async () => {
      const results = await db.read([
        {
          entityType: 'item',
          where: { type: 'gte', attribute: QItem.score.key, value: 20 },
        },
      ]);
      const result = results[0];
      assert.defined(result, 'result must be defined');
      const ids = result.entities.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t2', 't3', 't4']);
    });

    test('where lt matches values less than', async () => {
      const results = await db.read([
        {
          entityType: 'item',
          where: { type: 'lt', attribute: QItem.score.key, value: 20 },
        },
      ]);
      const result = results[0];
      assert.defined(result, 'result must be defined');
      const ids = result.entities.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t1']);
    });

    test('where lte matches values less than or equal', async () => {
      const results = await db.read([
        {
          entityType: 'item',
          where: { type: 'lte', attribute: QItem.score.key, value: 20 },
        },
      ]);
      const result = results[0];
      assert.defined(result, 'result must be defined');
      const ids = result.entities.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t1', 't2']);
    });

    test('where contains matches substring', async () => {
      const results = await db.read([
        {
          entityType: 'item',
          where: {
            type: 'contains',
            attribute: QItem.name.key,
            value: 'Gadget',
          },
        },
      ]);
      const result = results[0];
      assert.defined(result, 'result must be defined');
      expect(result.entities).toHaveLength(1);
      const entity = result.entities[0];
      assert.defined(entity, 'entity must be defined');
      expect(entity.entityId).toBe('t2');
    });

    test('where exists matches entities that have the attribute', async () => {
      const results = await db.read([
        {
          entityType: 'item',
          where: { type: 'exists', attribute: QItem.tag.key },
        },
      ]);
      const result = results[0];
      assert.defined(result, 'result must be defined');
      const ids = result.entities.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t1', 't2', 't3']);
    });

    test('where not_exists matches entities missing the attribute', async () => {
      const results = await db.read([
        {
          entityType: 'item',
          where: { type: 'not_exists', attribute: QItem.tag.key },
        },
      ]);
      const result = results[0];
      assert.defined(result, 'result must be defined');
      expect(result.entities).toHaveLength(1);
      const entity = result.entities[0];
      assert.defined(entity, 'entity must be defined');
      expect(entity.entityId).toBe('t4');
    });

    test('where and requires all clauses to match', async () => {
      const results = await db.read([
        {
          entityType: 'item',
          where: {
            type: 'and',
            clauses: [
              { type: '=', attribute: QItem.tag.key, value: 'a' },
              { type: 'gt', attribute: QItem.score.key, value: 15 },
            ],
          },
        },
      ]);
      const result = results[0];
      assert.defined(result, 'result must be defined');
      expect(result.entities).toHaveLength(1);
      const entity = result.entities[0];
      assert.defined(entity, 'entity must be defined');
      expect(entity.entityId).toBe('t3');
    });

    test('where or requires any clause to match', async () => {
      const results = await db.read([
        {
          entityType: 'item',
          where: {
            type: 'or',
            clauses: [
              { type: '=', attribute: QItem.score.key, value: 10 },
              { type: '=', attribute: QItem.score.key, value: 40 },
            ],
          },
        },
      ]);
      const result = results[0];
      assert.defined(result, 'result must be defined');
      const ids = result.entities.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t1', 't4']);
    });

    test('where not inverts the clause', async () => {
      const results = await db.read([
        {
          entityType: 'item',
          where: {
            type: 'not',
            clause: { type: '=', attribute: QItem.tag.key, value: 'a' },
          },
        },
      ]);
      const result = results[0];
      assert.defined(result, 'result must be defined');
      const ids = result.entities.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t2']);
    });

    test('where not combined with exists covers missing attributes', async () => {
      const results = await db.read([
        {
          entityType: 'item',
          where: {
            type: 'or',
            clauses: [
              {
                type: 'not',
                clause: { type: '=', attribute: QItem.tag.key, value: 'a' },
              },
              { type: 'not_exists', attribute: QItem.tag.key },
            ],
          },
        },
      ]);
      const result = results[0];
      assert.defined(result, 'result must be defined');
      const ids = result.entities.map((e) => e.entityId).sort();
      expect(ids).toEqual(['t2', 't4']);
    });
  });
});
