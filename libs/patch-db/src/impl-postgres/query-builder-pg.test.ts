import { describe, expect, test } from 'bun:test';
import { buildWhereClause } from './query-builder-pg';
import { questionMarkParamsToDollarParams } from '@gamezilla/lib/sql-client/positional-params';

function toPgSql(clause: Parameters<typeof buildWhereClause>[0]): string {
  const { sql, params } = buildWhereClause(clause);
  const [pgSql] = questionMarkParamsToDollarParams(sql, params);
  return pgSql;
}

describe('buildWhereClause with namespaced attributes', () => {
  test('= clause with namespaced attribute', () => {
    const { sql, params } = buildWhereClause({
      type: '=',
      attribute: 'task/title',
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
      attribute: 'task/done',
      value: true,
    });
    expect(sql).toContain('IS DISTINCT FROM ?::text');
    expect(params[0]).toBe('task/done');
    expect(params[1]).toBe('true');
  });

  test('in clause with namespaced attribute', () => {
    const { sql, params } = buildWhereClause({
      type: 'in',
      attribute: 'task/status',
      values: ['open', 'closed'],
    });
    expect(sql).toContain('IN');
    expect(sql).toContain('?::text');
    expect(params[0]).toBe('task/status');
    expect(params).toContain('open');
    expect(params).toContain('closed');
  });

  test('and clause combining namespaced attributes', () => {
    const { sql, params } = buildWhereClause({
      type: 'and',
      clauses: [
        { type: '=', attribute: 'task/title', value: 'a' },
        { type: '=', attribute: 'task/done', value: false },
      ],
    });
    expect(sql).toContain('AND');
    expect(params).toEqual(['task/title', 'a', 'task/done', 'false']);
  });

  test('attribute with dot in namespace', () => {
    const { sql, params } = buildWhereClause({
      type: '=',
      attribute: 'game.session/score',
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
    const pgSql = toPgSql({ type: '=', attribute: 'task/done', value: true });
    expect(pgSql).toContain('$2::text');
    expect(pgSql).not.toMatch(/= \$2(?!::text)/);
  });

  test('= with number produces $N::text', () => {
    const pgSql = toPgSql({ type: '=', attribute: 'task/score', value: 42 });
    expect(pgSql).toContain('$2::text');
  });

  test('!= with boolean produces $N::text', () => {
    const pgSql = toPgSql({ type: '!=', attribute: 'task/done', value: false });
    expect(pgSql).toContain('$2::text');
  });

  test('gt/gte/lt/lte cast value to ::text', () => {
    for (const type of ['gt', 'gte', 'lt', 'lte'] as const) {
      const pgSql = toPgSql({ type, attribute: 'task/score', value: 10 });
      expect(pgSql).toContain('$2::text');
    }
  });

  test('in with mixed types casts every value to ::text', () => {
    const pgSql = toPgSql({
      type: 'in',
      attribute: 'task/status',
      values: ['open', true, 7],
    });
    expect(pgSql).toContain('$2::text');
    expect(pgSql).toContain('$3::text');
    expect(pgSql).toContain('$4::text');
  });

  test('not_in casts every value to ::text', () => {
    const pgSql = toPgSql({
      type: 'not_in',
      attribute: 'task/status',
      values: [false, 'closed'],
    });
    expect(pgSql).toContain('$3::text');
    expect(pgSql).toContain('$4::text');
  });

  test('contains casts value to ::text', () => {
    const pgSql = toPgSql({
      type: 'contains',
      attribute: 'task/name',
      value: 'foo',
    });
    expect(pgSql).toContain('$2::text');
  });
});
