import { describe, expect, test } from 'bun:test';
import { buildWhereClause } from './query-builder-pg';

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

  test('= clause with boolean value casts to text', () => {
    const { sql, params } = buildWhereClause({
      type: '=',
      attribute: 'task/done',
      value: true,
    });
    expect(sql).toContain('= ?::text');
    expect(params[0]).toBe('task/done');
    expect(params[1]).toBe(true);
  });

  test('!= clause with namespaced attribute', () => {
    const { sql, params } = buildWhereClause({
      type: '!=',
      attribute: 'task/done',
      value: true,
    });
    expect(sql).toContain('IS DISTINCT FROM ?::text');
    expect(params[0]).toBe('task/done');
    expect(params[1]).toBe(true);
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
    expect(params).toEqual(['task/title', 'a', 'task/done', false]);
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
    expect(params[1]).toBe(42);
  });
});
