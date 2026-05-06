import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { assert } from '@gamezilla/lib/assert';
import {
  buildLimitSQL,
  buildOrderSQL,
  buildPatchConditions,
  buildSnapshotConditions,
  buildWhereClause,
} from './query-builder';

/** Node crash handler calls `process.exit`; register one that throws so tests can assert failures. */
function registerThrowingCrashHandlerForTests(): () => void {
  return assert.registerCrashHandler({
    priority: 5,
    match: () => true,
    crash(message, context) {
      const err = new Error(message);
      Object.assign(err, { context });
      throw err;
    },
  });
}

let disposeCrash: () => void;
beforeAll(() => {
  disposeCrash = registerThrowingCrashHandlerForTests();
});
afterAll(() => {
  disposeCrash();
});

describe('tiger-style invariants in sqlite query-builder', () => {
  test('empty `in` short-circuits to (1 = 0) with no params', () => {
    const { sql, params } = buildWhereClause({
      type: 'in',
      attribute: 'task/status',
      values: [],
    });
    expect(sql).toBe('(1 = 0)');
    expect(params).toEqual([]);
  });

  test('empty `not_in` short-circuits to (1 = 1) with no params', () => {
    const { sql, params } = buildWhereClause({
      type: 'not_in',
      attribute: 'task/status',
      values: [],
    });
    expect(sql).toBe('(1 = 1)');
    expect(params).toEqual([]);
  });

  test('empty `and` short-circuits to vacuously true', () => {
    const { sql, params } = buildWhereClause({ type: 'and', clauses: [] });
    expect(sql).toBe('(1 = 1)');
    expect(params).toEqual([]);
  });

  test('empty `or` short-circuits to vacuously false', () => {
    const { sql, params } = buildWhereClause({ type: 'or', clauses: [] });
    expect(sql).toBe('(1 = 0)');
    expect(params).toEqual([]);
  });

  test('empty `in` nested under `and` yields ((other) AND (1 = 0))', () => {
    const { sql, params } = buildWhereClause({
      type: 'and',
      clauses: [
        { type: '=', attribute: 'task/title', value: 'a' },
        { type: 'in', attribute: 'task/status', values: [] },
      ],
    });
    expect(sql).toContain('(1 = 0)');
    expect(sql).toContain(' AND ');
    expect(params).toEqual(['$."task/title"', 'a']);
  });

  test('empty `not_in` nested under `or` yields ((other) OR (1 = 1))', () => {
    const { sql, params } = buildWhereClause({
      type: 'or',
      clauses: [
        { type: '=', attribute: 'task/title', value: 'a' },
        { type: 'not_in', attribute: 'task/status', values: [] },
      ],
    });
    expect(sql).toContain('(1 = 1)');
    expect(sql).toContain(' OR ');
    expect(params).toEqual(['$."task/title"', 'a']);
  });

  test('empty entityId[] in snapshot conditions short-circuits to 1 = 0', () => {
    const { conditions, params } = buildSnapshotConditions({ entityId: [] });
    expect(conditions).toContain('1 = 0');
    expect(params).toEqual([]);
  });

  test('empty entityId[] in patch conditions short-circuits to 1 = 0', () => {
    const { conditions, params } = buildPatchConditions({ entityId: [] });
    expect(conditions).toContain('1 = 0');
    expect(params).toEqual([]);
  });

  test('rejects unsafe column prefix interpolated into WHERE', () => {
    expect(() =>
      buildWhereClause(
        { type: 'exists', attribute: 'task/title' },
        'p; DROP--'
      )
    ).toThrow();
  });

  test('rejects unsafe table alias interpolated into patch conditions', () => {
    expect(() =>
      buildPatchConditions(
        { entityType: 'task' },
        'p; DROP TABLE patches; --'
      )
    ).toThrow();
  });

  test('rejects negative limit', () => {
    expect(() => buildLimitSQL({ limit: -1 })).toThrow();
  });

  test('rejects fractional offset', () => {
    expect(() => buildLimitSQL({ offset: 1.5 })).toThrow();
  });

  test('rejects unsafe attributePrefix in ORDER BY', () => {
    expect(() =>
      buildOrderSQL(
        { orderBy: [{ attribute: 'task/title', direction: 'asc' }] },
        'ORDER BY id ASC',
        'p; DROP--'
      )
    ).toThrow();
  });

  test('happy path: builds well-formed `in` clause for non-empty values', () => {
    const { sql, params } = buildWhereClause({
      type: 'in',
      attribute: 'task/status',
      values: ['open'],
    });
    expect(sql).toContain('IN (?)');
    expect(params).toEqual(['$."task/status"', 'open']);
  });
});
