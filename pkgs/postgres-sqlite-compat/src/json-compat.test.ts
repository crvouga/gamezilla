/**
 * Golden matrix: same JSON1 SQL snippets on Bun SQLite vs PGlite after
 * {@link installPostgresSqliteCompat}.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { PGlite } from '@electric-sql/pglite';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { createPgliteSqlClient } from '@pkgs/sql-client/postgres/impl-pglite';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client/sqlite/impl-bun-sqlite';
import { installPostgresSqliteCompat } from './install';

type Backend = {
  readonly name: string;
  readonly client: SqlClient;
  readonly close: () => Promise<void>;
};

async function openSqlite(): Promise<Backend> {
  const db = new Database(':memory:');
  const client = new SqlClientImplBunSqlite(db);
  return {
    name: 'sqlite',
    client,
    close: async () => {
      db.close(false);
    },
  };
}

async function openPostgresCompat(): Promise<Backend> {
  const db = await PGlite.create();
  const client = createPgliteSqlClient(db);
  await installPostgresSqliteCompat({ sqlClient: client });
  return {
    name: 'postgres+compat',
    client,
    close: async () => {
      await db.close();
    },
  };
}

const SAMPLE = '{"a":2,"c":[4,5,{"f":7}],"s":"xyz","n":null}';

describe('postgres-sqlite-compat JSON1 goldens', () => {
  const backends: Backend[] = [];

  beforeAll(async () => {
    backends.push(await openSqlite(), await openPostgresCompat());
  });

  afterAll(async () => {
    for (const b of backends) {
      await b.close();
    }
  });

  test('json_extract single path', async () => {
    for (const b of backends) {
      const rows = await b.client.query(
        sql<{ v: string | number | null }>`
          SELECT json_extract(${SAMPLE}, ${'$.c[2].f'}) AS v`
      );
      expect(String(rows[0]?.v), b.name).toBe('7');
    }
  });

  test('json_extract missing path is null', async () => {
    for (const b of backends) {
      const rows = await b.client.query(
        sql<{ v: string | null }>`
          SELECT json_extract(${SAMPLE}, ${'$.missing'}) AS v`
      );
      expect(rows[0]?.v ?? null, b.name).toBeNull();
    }
  });

  test('json_extract string atom', async () => {
    for (const b of backends) {
      const rows = await b.client.query(
        sql<{ v: string | null }>`
          SELECT json_extract(${SAMPLE}, ${'$.s'}) AS v`
      );
      expect(rows[0]?.v, b.name).toBe('xyz');
    }
  });

  test('json_array_length', async () => {
    for (const b of backends) {
      const rows = await b.client.query(
        sql<{ v: number | null }>`
          SELECT json_array_length(${SAMPLE}, ${'$.c'}) AS v`
      );
      expect(Number(rows[0]?.v), b.name).toBe(3);
    }
  });

  test('json_valid', async () => {
    for (const b of backends) {
      const ok = await b.client.query(
        sql<{ v: number | boolean }>`
          SELECT json_valid(${'{"a":1}'}) AS v`
      );
      const bad = await b.client.query(
        sql<{ v: number | boolean }>`
          SELECT json_valid(${'{'}) AS v`
      );
      expect(Boolean(ok[0]?.v), b.name).toBe(true);
      expect(Boolean(bad[0]?.v), b.name).toBe(false);
    }
  });

  test('json_type', async () => {
    for (const b of backends) {
      const rows = await b.client.query(
        sql<{ v: string | null }>`
          SELECT json_type(${SAMPLE}, ${'$.c'}) AS v`
      );
      expect(rows[0]?.v, b.name).toBe('array');
    }
  });

  test('json_each over object', async () => {
    for (const b of backends) {
      const rows = await b.client.query(
        sql<{ key: string | number; atom: string | number | null }>`
          SELECT key, atom FROM json_each(${'{"x":1,"y":"z"}'})
          ORDER BY key`
      );
      expect(
        rows.map((r) => [String(r.key), r.atom === null ? null : String(r.atom)]),
        b.name
      ).toEqual([
        ['x', '1'],
        ['y', 'z'],
      ]);
    }
  });

  test('json_each over array', async () => {
    for (const b of backends) {
      const rows = await b.client.query(
        sql<{ key: string | number; atom: string | number | null }>`
          SELECT key, atom FROM json_each(${'[10,20]'})
          ORDER BY key`
      );
      expect(
        rows.map((r) => [String(r.key), r.atom === null ? null : String(r.atom)]),
        b.name
      ).toEqual([
        ['0', '10'],
        ['1', '20'],
      ]);
    }
  });

  test('install is idempotent', async () => {
    const pg = backends.find((b) => b.name === 'postgres+compat');
    expect(pg).toBeDefined();
    assertDefined(pg);
    await installPostgresSqliteCompat({ sqlClient: pg.client });
    const rows = await pg.client.query(
      sql<{ v: string | null }>`
        SELECT json_extract(${'{"k":9}'}, ${'$.k'}) AS v`
    );
    expect(rows[0]?.v).toBe('9');
  });
});

function assertDefined<T>(v: T | undefined): asserts v is T {
  if (v === undefined) throw new Error('expected defined');
}
