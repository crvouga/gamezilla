import { describe, expect, test } from 'bun:test';
import {
  assertAgnosticSql,
  findAgnosticSqlBan,
  NonAgnosticSqlError,
} from '@pkgs/sql-client-root-shared-ts/agnostic-sql';
import { SqlClientImplAgnostic } from '@pkgs/sql-client-root-shared-ts/impl-agnostic';
import { createInMemorySqlClient } from '@pkgs/sql-client-root-shared-ts/impl-in-memory';
import sql from '@pkgs/sql-root-shared-ts/sql';

describe('assertAgnosticSql', () => {
  test('allows portable SQL', () => {
    expect(() =>
      assertAgnosticSql(
        'SELECT id FROM waiting WHERE claim_token IS NULL LIMIT ?'
      )
    ).not.toThrow();
    expect(
      findAgnosticSqlBan(
        'INSERT INTO t (id, value) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET value = excluded.value'
      )
    ).toBeNull();
  });

  test('rejects vendor casts and jsonb helpers', () => {
    expect(findAgnosticSqlBan('INSERT INTO t (v) VALUES (?::jsonb)')).toBe(
      '::jsonb cast'
    );
    expect(findAgnosticSqlBan('SELECT x::timestamptz FROM t')).toBe(
      '::timestamptz cast'
    );
    expect(findAgnosticSqlBan('SELECT jsonb_array_length(v) FROM t')).toBe(
      'jsonb_* function'
    );
    expect(findAgnosticSqlBan("SELECT meta->>'k' FROM t")).toBe(
      'jsonb -> operator'
    );
  });

  test('rejects locks and pg catalog', () => {
    expect(findAgnosticSqlBan('SELECT id FROM t FOR UPDATE')).toBe(
      'FOR UPDATE'
    );
    expect(
      findAgnosticSqlBan('SELECT pg_advisory_xact_lock(hashtext(?))')
    ).toBe('pg_advisory_*');
    expect(findAgnosticSqlBan('SELECT 1 FROM pg_catalog.pg_class')).toBe(
      'pg_catalog'
    );
  });

  test('rejects SQLite wall / engine-only and PG type names', () => {
    expect(findAgnosticSqlBan('PRAGMA user_version')).toBe('PRAGMA');
    expect(findAgnosticSqlBan("SELECT datetime('now')")).toBe(
      "datetime('now')"
    );
    expect(findAgnosticSqlBan('CREATE TABLE t (v JSONB)')).toBe('JSONB type');
    expect(findAgnosticSqlBan('CREATE TABLE t (ts TIMESTAMPTZ)')).toBe(
      'TIMESTAMPTZ type'
    );
  });

  test('throws NonAgnosticSqlError with kind', () => {
    try {
      assertAgnosticSql('SELECT 1 FOR UPDATE');
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(NonAgnosticSqlError);
      expect((err as NonAgnosticSqlError).kind).toBe('FOR UPDATE');
    }
  });
});

describe('SqlClientImplAgnostic', () => {
  test('delegates portable query/run', async () => {
    const client = new SqlClientImplAgnostic(createInMemorySqlClient());
    const rows = await client.query(sql<{ x: number }>`SELECT 1 AS x`);
    expect(rows).toEqual([]);
    await client.run(sql`INSERT INTO t (id) VALUES (${'a'})`);
  });

  test('crashes on non-agnostic SQL before inner', async () => {
    const client = new SqlClientImplAgnostic(createInMemorySqlClient());
    await expect(
      client.query(sql<{ id: string }>`SELECT id FROM t FOR UPDATE`)
    ).rejects.toBeInstanceOf(NonAgnosticSqlError);
    await expect(
      client.run(sql`INSERT INTO t (v) VALUES (${'{}'}::jsonb)`)
    ).rejects.toBeInstanceOf(NonAgnosticSqlError);
  });

  test('wraps transaction handles', async () => {
    const client = new SqlClientImplAgnostic(createInMemorySqlClient());
    await expect(
      client.transaction(async (tx) => {
        await tx.run(sql`SELECT 1 FOR UPDATE`);
      })
    ).rejects.toBeInstanceOf(NonAgnosticSqlError);
  });
});
