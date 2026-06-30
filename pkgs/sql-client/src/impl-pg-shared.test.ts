import { describe, expect, test } from 'bun:test';
import {
  pgQueryWithOptionalSearchPathPin,
  pgRawQueryWithSearchPathPin,
  pgRunResultFromQuery,
  readLastInsertRowid,
  type PgExecutor,
} from './impl-pg-shared';
import { createPostgresDbScope } from './postgres-schema';

const testScope = createPostgresDbScope('gamezilla');

describe('readLastInsertRowid', () => {
  test('returns 0 when rows is undefined (multi-statement SET + DDL)', () => {
    expect(readLastInsertRowid(undefined)).toBe(0);
    expect(
      pgRunResultFromQuery({ rows: undefined, rowCount: null } as never)
    ).toEqual({
      changes: 0,
      lastInsertRowid: 0,
    });
  });
});

describe('pgQueryWithOptionalSearchPathPin', () => {
  test('checks out one pool client so SET and query share a session', async () => {
    const calls: { text: string; vals?: unknown[] }[] = [];
    const client = {
      query: async (text: string, vals?: unknown[]) => {
        calls.push(vals === undefined ? { text } : { text, vals });
        return { rows: [{ ok: 1 }], rowCount: 1 };
      },
      release: () => undefined,
    };
    const queryable = {
      connect: async () => client,
      totalCount: 1,
    } as unknown as PgExecutor;
    await pgQueryWithOptionalSearchPathPin({
      queryable,
      dbScope: testScope,
      pinSearchPathEachQuery: true,
      sql: 'SELECT 1 FROM kv LIMIT 1',
    });
    expect(calls).toHaveLength(2);
    expect(calls[0]?.text).toContain('SET search_path TO');
    expect(calls[1]?.text).toBe('SELECT 1 FROM kv LIMIT 1');
  });

  test('pins search_path separately before no-param queries on pooler connections', async () => {
    const calls: { text: string; vals?: unknown[] }[] = [];
    const queryable = {
      query: async (text: string, vals?: unknown[]) => {
        calls.push(vals === undefined ? { text } : { text, vals });
        return { rows: [{ ok: 1 }], rowCount: 1 };
      },
    } as unknown as PgExecutor;
    await pgQueryWithOptionalSearchPathPin({
      queryable,
      dbScope: testScope,
      pinSearchPathEachQuery: true,
      sql: 'SELECT 1 FROM kv LIMIT 1',
    });
    expect(calls).toHaveLength(2);
    expect(calls[0]?.text).toContain('SET search_path TO');
    expect(calls[1]?.text).toBe('SELECT 1 FROM kv LIMIT 1');
  });

  test('pins search_path separately before parameterized queries', async () => {
    const calls: { text: string; vals?: unknown[] }[] = [];
    const queryable = {
      query: async (text: string, vals?: unknown[]) => {
        calls.push(vals === undefined ? { text } : { text, vals });
        return { rows: [], rowCount: 0 };
      },
    } as unknown as PgExecutor;
    await pgQueryWithOptionalSearchPathPin({
      queryable,
      dbScope: testScope,
      pinSearchPathEachQuery: true,
      sql: 'SELECT 1 FROM kv WHERE key = ?',
      params: ['dev-idp'],
    });
    expect(calls).toHaveLength(2);
    expect(calls[0]?.text).toContain('SET search_path TO');
    expect(calls[1]?.text).toBe('SELECT 1 FROM kv WHERE key = $1');
    expect(calls[1]?.vals).toEqual(['dev-idp']);
  });
});

describe('pgRawQueryWithSearchPathPin', () => {
  test('pins search_path separately before native $1 queries', async () => {
    const calls: { text: string; vals?: unknown[] }[] = [];
    const queryable = {
      query: async (text: string, vals?: unknown[]) => {
        calls.push(vals === undefined ? { text } : { text, vals });
        return { rows: [], rowCount: 0 };
      },
    } as unknown as PgExecutor;
    await pgRawQueryWithSearchPathPin({
      queryable,
      execQuery: queryable.query.bind(queryable),
      dbScope: testScope,
      pinSearchPathEachQuery: true,
      text: 'SELECT 1 FROM verification WHERE identifier = $1',
      values: ['oauth-state'],
    });
    expect(calls).toHaveLength(2);
    expect(calls[0]?.text).toContain('SET search_path TO');
    expect(calls[1]?.text).toBe(
      'SELECT 1 FROM verification WHERE identifier = $1'
    );
    expect(calls[1]?.vals).toEqual(['oauth-state']);
  });
});
