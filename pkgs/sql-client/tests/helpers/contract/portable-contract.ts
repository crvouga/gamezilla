/**
 * Shared portable contract — int8 wire-safety + basic DML — for every
 * in-process SqlClient (SQLite + Postgres with JSON1 compat).
 */
import { afterEach, beforeEach, expect, test } from 'bun:test';
import { defineTable, registerTables, type TableDef } from '@pkgs/db-schema';
import { applyPostgresSchema } from '@pkgs/db-schema/postgres';
import { applySqliteSchema } from '@pkgs/db-schema/sqlite';
import { raw } from '@pkgs/sql';
import type { PostgresSqlClient, SqlClient } from '../../../src/interface';
import { createPostgresDbScope } from '../../../src/postgres/schema';
import {
  assertWireSafeRows,
  assertWireSafeRunResult,
} from '../oracles/wire-safety';

export type PortableClientFactory = () => SqlClient | Promise<SqlClient>;

export type PortableContractOpts = {
  readonly dialect: 'sqlite' | 'postgres';
  readonly name: string;
  /** Shared engines (PGlite) — do not disconnect between tests. */
  readonly shared?: boolean;
};

async function applySchema(
  client: SqlClient,
  tables: readonly TableDef[],
  dialect: PortableContractOpts['dialect']
): Promise<void> {
  const schema = registerTables(tables);
  if (dialect === 'postgres') {
    const dbScope =
      'dbScope' in client && (client as PostgresSqlClient).dbScope !== undefined
        ? (client as PostgresSqlClient).dbScope
        : createPostgresDbScope('public');
    await applyPostgresSchema(client, schema, dbScope, {
      skipAdvisoryLock: true,
    });
    return;
  }
  await applySqliteSchema(client, schema);
}

function registerInt8WireSafetyTest(
  client: () => SqlClient,
  table: string,
  opts: PortableContractOpts
): void {
  test('int8 / INTEGER select + COUNT are JSON-safe numbers', async () => {
    await applySchema(
      client(),
      [
        defineTable({
          domain: 'portable',
          name: table,
          columns: { n: 'integer' },
        }),
      ],
      opts.dialect
    );
    const inserted = await client().run(
      raw(`INSERT INTO ${table} (id, n) VALUES ('a', 42)`)
    );
    assertWireSafeRunResult(inserted, `${opts.name}:insert`);

    const rows = await client().query<{ n: number }>(
      raw(`SELECT n FROM ${table}`)
    );
    assertWireSafeRows(rows, `${opts.name}:select`);
    expect(rows[0]?.n).toBe(42);
    expect(typeof rows[0]?.n).toBe('number');
    expect(() => JSON.stringify(rows)).not.toThrow();
    expect(Math.max(0, rows[0]!.n)).toBe(42);

    const counts = await client().query<{ n: number | string }>(
      raw(`SELECT COUNT(*) AS n FROM ${table}`)
    );
    assertWireSafeRows(counts, `${opts.name}:count`);
    expect(Number(counts[0]?.n)).toBe(1);
    expect(typeof counts[0]?.n).not.toBe('bigint');
  });
}

function registerSoftDeleteTest(
  client: () => SqlClient,
  table: string,
  opts: PortableContractOpts
): void {
  test('soft-delete IS NULL filter', async () => {
    await applySchema(
      client(),
      [
        defineTable({
          domain: 'portable',
          name: table,
          columns: { body: 'text' },
        }),
      ],
      opts.dialect
    );
    await client().run(
      raw(
        `INSERT INTO ${table} (id, body, deleted_at) VALUES ('n1', 'hello', NULL)`
      )
    );
    const live = await client().query<{ id: string; body: string }>(
      raw(`SELECT id, body FROM ${table} WHERE deleted_at IS NULL ORDER BY id`)
    );
    assertWireSafeRows(live, `${opts.name}:soft-delete-live`);
    expect(live).toEqual([{ id: 'n1', body: 'hello' }]);

    await client().run(
      raw(
        `UPDATE ${table} SET deleted_at = '2020-06-01T00:00:00.000Z' WHERE id = 'n1'`
      )
    );
    const after = await client().query<{ id: string }>(
      raw(`SELECT id FROM ${table} WHERE deleted_at IS NULL`)
    );
    assertWireSafeRows(after, `${opts.name}:soft-delete-after`);
    expect(after).toEqual([]);
  });
}

function registerPostgresInt8CastTest(
  client: () => SqlClient,
  opts: PortableContractOpts
): void {
  test('::int8 cast returns number', async () => {
    const rows = await client().query<{ n: number }>(
      raw(`SELECT 42::int8 AS n`)
    );
    assertWireSafeRows(rows, `${opts.name}:int8-cast`);
    expect(rows[0]?.n).toBe(42);
    expect(typeof rows[0]?.n).toBe('number');
  });
}

/** Example-based portable contract (Hermes int8 pin + soft-delete DML). */
export function runPortableContractTests(
  factory: PortableClientFactory,
  opts: PortableContractOpts
): void {
  let client: SqlClient;
  const table = `portable_${opts.name.replace(/[^a-z0-9]/gi, '_')}`;

  beforeEach(async () => {
    client = await Promise.resolve(factory());
    await client.connect();
  });

  afterEach(async () => {
    try {
      await client.run(raw(`DROP TABLE IF EXISTS ${table}`));
    } catch {
      // ignore
    }
    if (opts.shared === true) return;
    try {
      await client.disconnect();
    } catch {
      // already disconnected
    }
  });

  registerInt8WireSafetyTest(() => client, table, opts);
  registerSoftDeleteTest(() => client, table, opts);
  if (opts.dialect === 'postgres') {
    registerPostgresInt8CastTest(() => client, opts);
  }
}
