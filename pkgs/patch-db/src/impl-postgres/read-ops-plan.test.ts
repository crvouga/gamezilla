/**
 * Pure tests for the read-batch planner used by `readPatches`. Asserts:
 *   - bare-single-entity batches stay grouped (one round-trip preserved),
 *   - heterogeneous queries split into individual `one` units,
 *   - `compareSingleUnits` produces a stable, deterministic order keyed by
 *     `shapeKeyForQuery`,
 *   - `shapeKeyForQuery` is sensitive to the structural fields the planner
 *     declares it cares about.
 */
import { describe, expect, test } from 'bun:test';
import type { PatchDbQuery } from '../interface';
import {
  compareSingleUnits,
  planReadUnits,
  shapeKeyForQuery,
} from './read-ops-plan';

/**
 * `PatchDbQuery` brands `attribute` as `Keyword`. Tests just need structural
 * shape, not branded validation, so cast through this helper rather than
 * paying for a real `asKeyword` parse on every literal.
 */
const Q = (q: unknown): PatchDbQuery => q as PatchDbQuery;

describe('shapeKeyForQuery', () => {
  test('identical query shapes produce identical keys', () => {
    expect(shapeKeyForQuery(Q({ entityType: 'task', limit: 10 }))).toBe(
      shapeKeyForQuery(Q({ entityType: 'task', limit: 10 }))
    );
  });

  test('differing where clauses produce different keys', () => {
    const a = Q({
      entityType: 'task',
      where: { type: '=', attribute: 'task/status', value: 'a' },
    });
    const b = Q({
      entityType: 'task',
      where: { type: '=', attribute: 'task/status', value: 'b' },
    });
    expect(shapeKeyForQuery(a)).not.toBe(shapeKeyForQuery(b));
  });

  test('different entity types produce different keys', () => {
    expect(shapeKeyForQuery(Q({ entityType: 'task' }))).not.toBe(
      shapeKeyForQuery(Q({ entityType: 'item' }))
    );
  });

  test('limit and offset participate in the key', () => {
    expect(shapeKeyForQuery(Q({ entityType: 'task', limit: 10 }))).not.toBe(
      shapeKeyForQuery(Q({ entityType: 'task', limit: 20 }))
    );
    expect(shapeKeyForQuery(Q({ entityType: 'task', offset: 0 }))).not.toBe(
      shapeKeyForQuery(Q({ entityType: 'task', offset: 5 }))
    );
  });
});

describe('planReadUnits', () => {
  test('groups consecutive bare same-entity queries into one bareBatch', () => {
    const queries = [
      Q({ entityType: 'task', entityId: 'a' }),
      Q({ entityType: 'task', entityId: 'b' }),
      Q({ entityType: 'task', entityId: 'c' }),
    ];
    const units = planReadUnits(queries);
    expect(units.length).toBe(1);
    expect(units[0]?.kind).toBe('bareBatch');
    if (units[0]?.kind === 'bareBatch') {
      expect(units[0].indices).toEqual([0, 1, 2]);
    }
  });

  test('breaks the batch when entity types switch', () => {
    const queries = [
      Q({ entityType: 'task', entityId: 'a' }),
      Q({ entityType: 'task', entityId: 'b' }),
      Q({ entityType: 'item', entityId: 'c' }),
      Q({ entityType: 'task', entityId: 'd' }),
    ];
    const units = planReadUnits(queries);
    // task/task is a batch, then item is a `one`, then task is another `one`
    // (single-element runs cannot become a `bareBatch`).
    expect(units.length).toBe(3);
    expect(units[0]?.kind).toBe('bareBatch');
    expect(units[1]?.kind).toBe('one');
    expect(units[2]?.kind).toBe('one');
  });

  test('queries with `where` are never batched (kind=one)', () => {
    const queries = [
      Q({
        entityType: 'task',
        entityId: 'a',
        where: { type: '=', attribute: 'task/status', value: 'open' },
      }),
      Q({ entityType: 'task', entityId: 'b' }),
    ];
    const units = planReadUnits(queries);
    expect(units.length).toBe(2);
    expect(units[0]?.kind).toBe('one');
    expect(units[1]?.kind).toBe('one');
  });

  test('preserves original indices for response rehydration', () => {
    const queries = [
      Q({ entityType: 'task', entityId: 'a' }),
      Q({ entityType: 'task', entityId: 'b' }),
      Q({ entityType: 'item', entityId: 'c' }),
    ];
    const units = planReadUnits(queries);
    const indices = new Set<number>();
    for (const u of units) {
      if (u.kind === 'bareBatch') {
        for (const i of u.indices) indices.add(i);
      } else {
        indices.add(u.index);
      }
    }
    expect([...indices].sort()).toEqual([0, 1, 2]);
  });
});

describe('compareSingleUnits', () => {
  test('orders by shape key first, original index as tiebreaker', () => {
    const u1 = { index: 5, query: Q({ entityType: 'a' }) };
    const u2 = { index: 2, query: Q({ entityType: 'b' }) };
    const u3 = { index: 7, query: Q({ entityType: 'a' }) };
    const sorted = [u1, u2, u3].slice().sort(compareSingleUnits);
    // entityType 'a' (u1, u3) come before 'b' (u2). Among 'a's, lower index wins.
    expect(sorted.map((s) => s.index)).toEqual([5, 7, 2]);
  });

  test('is deterministic across shuffles', () => {
    const queries = [
      { index: 0, query: Q({ entityType: 'task', limit: 10 }) },
      { index: 1, query: Q({ entityType: 'task', limit: 5 }) },
      { index: 2, query: Q({ entityType: 'item' }) },
      { index: 3, query: Q({ entityType: 'task', limit: 10 }) },
    ];
    const a = queries.slice().sort(compareSingleUnits);
    const b = queries.slice().reverse().sort(compareSingleUnits);
    expect(a.map((q) => q.index)).toEqual(b.map((q) => q.index));
  });
});
