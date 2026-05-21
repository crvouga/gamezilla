import { assert } from '@pkgs/assert';
import { asKeyword } from '@pkgs/keyword';
import { questionMarkParamsToDollarParams } from '@pkgs/sql-client/positional-params';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { QGameSession, QTask } from '../test/query-test-attrs';
import {
  buildLimitSQL,
  buildOrderSQL,
  buildPatchConditions,
  buildSnapshotConditions,
  buildWhereClause,
} from './query-builder-pg';

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

function toPgSql(clause: Parameters<typeof buildWhereClause>[0]): string {
  const { sql, params } = buildWhereClause(clause);
  const [pgSql] = questionMarkParamsToDollarParams(sql, params);
  return pgSql;
}

describe('buildWhereClause with namespaced attributes', () => {
  test('= clause with namespaced attribute', () => {
    const { sql, params } = buildWhereClause({
      type: '=',
      attribute: QTask.title.key,
      value: 'hello',
    });
    expect(sql).toContain('->>');
    expect(sql).toContain('?::text');
    expect(params[0]).toBe('task/title');
    expect(params[1]).toBe('hello');
  });

  test('!= clause with namespaced attribute', () => {
    const { sql, params } = buildWhereClause({
      type: '!=',
      attribute: QTask.done.key,
      value: true,
    });
    expect(sql).toContain('IS DISTINCT FROM ?::text');
    expect(params[0]).toBe('task/done');
    expect(params[1]).toBe('true');
  });

  test('in clause with namespaced attribute', () => {
    const { sql, params } = buildWhereClause({
      type: 'in',
      attribute: QTask.status.key,
      values: ['open', 'closed'],
    });
    expect(sql).toContain('IN');
    expect(sql).toContain('?::text');
    expect(params[0]).toBe('task/status');
    expect(params).toContain('open');
    expect(params).toContain('closed');
  });

  test('wire query: string attribute key matches tag .key SQL', () => {
    const tag = buildWhereClause({
      type: '=',
      attribute: QTask.title.key,
      value: 'hello',
    });
    const wire = buildWhereClause({
      type: '=',
      attribute: asKeyword('task/title'),
      value: 'hello',
    });
    expect(wire.sql).toBe(tag.sql);
    expect(wire.params).toEqual(tag.params);
  });

  test('and clause combining namespaced attributes', () => {
    const { sql, params } = buildWhereClause({
      type: 'and',
      clauses: [
        { type: '=', attribute: QTask.title.key, value: 'a' },
        { type: '=', attribute: QTask.done.key, value: false },
      ],
    });
    expect(sql).toContain('AND');
    expect(params).toEqual(['task/title', 'a', 'task/done', 'false']);
  });

  test('attribute with dot in namespace', () => {
    const { sql, params } = buildWhereClause({
      type: '=',
      attribute: QGameSession.score.key,
      value: 42,
    });
    expect(sql).toContain('->>');
    expect(sql).toContain('?::text');
    expect(params[0]).toBe('game.session/score');
    expect(params[1]).toBe('42');
  });
});

describe('->> value params cast to ::text (prevents PG "operator does not exist: text = <type>")', () => {
  test('= with boolean produces $N::text, not bare $N', () => {
    const pgSql = toPgSql({
      type: '=',
      attribute: QTask.done.key,
      value: true,
    });
    expect(pgSql).toContain('$2::text');
    expect(pgSql).not.toMatch(/= \$2(?!::text)/);
  });

  test('= with number produces $N::text', () => {
    const pgSql = toPgSql({ type: '=', attribute: QTask.score.key, value: 42 });
    expect(pgSql).toContain('$2::text');
  });

  test('!= with boolean produces $N::text', () => {
    const pgSql = toPgSql({
      type: '!=',
      attribute: QTask.done.key,
      value: false,
    });
    expect(pgSql).toContain('$2::text');
  });

  test('gt/gte/lt/lte with number cast to ::numeric for magnitude order', () => {
    for (const type of ['gt', 'gte', 'lt', 'lte'] as const) {
      const pgSql = toPgSql({ type, attribute: QTask.score.key, value: 10 });
      expect(pgSql).toContain('::numeric');
      expect(pgSql).toContain('$2::numeric');
    }
  });

  test('gt/gte/lt/lte with non-number cast value to ::text', () => {
    const pgSql = toPgSql({
      type: 'gt',
      attribute: QTask.status.key,
      value: 'open',
    });
    expect(pgSql).toContain('$2::text');
    expect(pgSql).not.toContain('::numeric');
  });

  test('in with mixed types casts every value to ::text', () => {
    const pgSql = toPgSql({
      type: 'in',
      attribute: QTask.status.key,
      values: ['open', true, 7],
    });
    expect(pgSql).toContain('$2::text');
    expect(pgSql).toContain('$3::text');
    expect(pgSql).toContain('$4::text');
  });

  test('not_in casts every value to ::text', () => {
    const pgSql = toPgSql({
      type: 'not_in',
      attribute: QTask.status.key,
      values: [false, 'closed'],
    });
    expect(pgSql).toContain('$3::text');
    expect(pgSql).toContain('$4::text');
  });

  test('contains casts value to ::text', () => {
    const pgSql = toPgSql({
      type: 'contains',
      attribute: QTask.name.key,
      value: 'foo',
    });
    expect(pgSql).toContain('$2::text');
  });
});

describe('tiger-style invariants in query-builder-pg', () => {
  test('empty `in` short-circuits to (1 = 0) with no params', () => {
    const { sql, params } = buildWhereClause({
      type: 'in',
      attribute: QTask.status.key,
      values: [],
    });
    expect(sql).toBe('(1 = 0)');
    expect(params).toEqual([]);
  });

  test('empty `not_in` short-circuits to (1 = 1) with no params', () => {
    const { sql, params } = buildWhereClause({
      type: 'not_in',
      attribute: QTask.status.key,
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
        { type: '=', attribute: QTask.title.key, value: 'a' },
        { type: 'in', attribute: QTask.status.key, values: [] },
      ],
    });
    expect(sql).toContain('(1 = 0)');
    expect(sql).toContain(' AND ');
    expect(params).toEqual(['task/title', 'a']);
  });

  test('empty `not_in` nested under `or` yields ((other) OR (1 = 1))', () => {
    const { sql, params } = buildWhereClause({
      type: 'or',
      clauses: [
        { type: '=', attribute: QTask.title.key, value: 'a' },
        { type: 'not_in', attribute: QTask.status.key, values: [] },
      ],
    });
    expect(sql).toContain('(1 = 1)');
    expect(sql).toContain(' OR ');
    expect(params).toEqual(['task/title', 'a']);
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
        { type: 'exists', attribute: QTask.title.key },
        'p; DROP--'
      )
    ).toThrow();
  });

  test('rejects unsafe table alias interpolated into patch conditions', () => {
    expect(() =>
      buildPatchConditions({ entityType: 'task' }, 'p; DROP TABLE patches; --')
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
        { orderBy: [{ attribute: QTask.title.key, direction: 'asc' }] },
        'ORDER BY id ASC',
        'p; DROP--'
      )
    ).toThrow();
  });

  test('wire query: string attribute in ORDER BY matches tag .key', () => {
    const def = 'ORDER BY id ASC';
    const tag = buildOrderSQL(
      { orderBy: [{ attribute: QTask.title.key, direction: 'desc' }] },
      def,
      ''
    );
    const wire = buildOrderSQL(
      { orderBy: [{ attribute: asKeyword('task/title'), direction: 'desc' }] },
      def,
      ''
    );
    expect(wire).toBe(tag);
  });

  test('happy path: builds well-formed `in` clause for non-empty values', () => {
    const { sql, params } = buildWhereClause({
      type: 'in',
      attribute: QTask.status.key,
      values: ['open'],
    });
    expect(sql).toContain('IN (?::text)');
    expect(params).toEqual(['task/status', 'open']);
  });
});
