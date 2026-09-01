/**
 * Portable SQL corpus: the same DML runs on sqlite-mem and PGlite (+ JSON1
 * compat). Lives here so `@pkgs/postgres-sqlite-compat` stays a leaf.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { defineTable, registerTables } from '@pkgs/db-schema';
import { applyPostgresSchema } from '@pkgs/db-schema/postgres';
import { applySqliteSchema } from '@pkgs/db-schema/sqlite';
import { installPostgresSqliteCompat } from '@pkgs/postgres-sqlite-compat';
import { sql } from '@pkgs/sql';
import type { PostgresSqlClient, SqlClient } from '../interface';
import { SqlClientImplSqliteMem } from '../sqlite/impl-sqlite-mem';
import { createPgliteSqlClient } from './impl-pglite';
import { createPostgresDbScope } from './schema';

type Backend = {
  readonly name: string;
  readonly client: SqlClient;
  close(): Promise<void>;
};

const notesSchema = registerTables([
  defineTable({
    domain: 'notes',
    name: 'notes',
    columns: { body: 'text' },
  }),
]);

function postgresDbScope(client: SqlClient): PostgresSqlClient['dbScope'] {
  if (
    'dbScope' in client &&
    (client as PostgresSqlClient).dbScope !== undefined
  ) {
    return (client as PostgresSqlClient).dbScope;
  }
  return createPostgresDbScope('public');
}

async function applyNotesSchema(
  client: SqlClient,
  dialect: 'sqlite' | 'postgres'
): Promise<void> {
  if (dialect === 'postgres') {
    await applyPostgresSchema(client, notesSchema, postgresDbScope(client), {
      skipAdvisoryLock: true,
    });
    return;
  }
  await applySqliteSchema(client, notesSchema);
}

async function openSqliteMem(): Promise<Backend> {
  const client = SqlClientImplSqliteMem.open();
  await client.connect();
  return {
    name: 'sqlite-mem',
    client,
    close: () => client.disconnect(),
  };
}

async function openPglite(): Promise<Backend> {
  const db = await PGlite.create();
  const client = createPgliteSqlClient(db);
  await installPostgresSqliteCompat({ sqlClient: client });
  return {
    name: 'pglite',
    client,
    close: async () => {
      await db.close();
    },
  };
}

describe('portable SQL corpus', () => {
  const backends: Backend[] = [];

  // PGlite WASM + plpgsql install exceeds bun's 5s default under CI load.
  beforeAll(async () => {
    backends.push(await openSqliteMem(), await openPglite());
  }, 120_000);

  afterAll(async () => {
    for (const b of backends) await b.close();
  }, 120_000);

  test('insert/select/soft-delete timestamps agree', async () => {
    const [sqlite, pg] = backends;
    if (!sqlite || !pg) {
      throw new Error('backends not opened');
    }

    for (const b of backends) {
      await applyNotesSchema(
        b.client,
        b.name === 'pglite' ? 'postgres' : 'sqlite'
      );
      await b.client.run(sql`
        INSERT INTO notes (id, body, deleted_at) VALUES (${'n1'}, ${'hello'}, ${null})
      `);
    }

    const sqliteRows = await sqlite.client.query(
      sql<{ id: string; body: string }>`
        SELECT id, body FROM notes WHERE deleted_at IS NULL ORDER BY id
      `
    );
    const pgRows = await pg.client.query(
      sql<{ id: string; body: string }>`
        SELECT id, body FROM notes WHERE deleted_at IS NULL ORDER BY id
      `
    );
    expect(pgRows).toEqual(sqliteRows);
  });

  test('PGlite int8 rows coerce bigint to number', async () => {
    const pg = backends.find((b) => b.name === 'pglite');
    if (pg === undefined) throw new Error('pglite backend missing');
    const rows = await pg.client.query<{ n: number }>(sql`
      SELECT 42::int8 AS n
    `);
    expect(rows[0]?.n).toBe(42);
    expect(typeof rows[0]?.n).toBe('number');
    expect(() => JSON.stringify(rows)).not.toThrow();
    expect(Math.max(0, rows[0]!.n)).toBe(42);
  });
});
