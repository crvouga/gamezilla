/**
 * Portable SQL corpus: the same DML runs on sqlite-mem and postgres-mem
 * (+ JSON1 compat). Lives here so `@pkgs/postgres-sqlite-compat` stays a leaf.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { defineTable, registerTables } from '@pkgs/db-schema';
import { applyPostgresSchema } from '@pkgs/db-schema-postgres';
import { applySqliteSchema } from '@pkgs/db-schema-sqlite';
import { sql } from '@pkgs/sql';
import type { PostgresSqlClient, SqlClient } from '@pkgs/sql-client/interface';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { SqlClientImplPostgresMem } from '@pkgs/sql-client-postgres/impl-postgres-mem';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client-sqlite/impl-sqlite-mem';

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

async function openPostgresMem(): Promise<Backend> {
  const client = SqlClientImplPostgresMem.open({
    seed: 1,
    dbScope: createPostgresDbScope('public'),
  });
  await client.connect();
  return {
    name: 'postgres-mem',
    client,
    close: () => client.disconnect(),
  };
}

describe('portable SQL corpus', () => {
  const backends: Backend[] = [];

  beforeAll(async () => {
    backends.push(await openSqliteMem(), await openPostgresMem());
  });

  afterAll(async () => {
    for (const b of backends) await b.close();
  });

  test('insert/select/soft-delete timestamps agree', async () => {
    const [sqlite, pg] = backends;
    if (!sqlite || !pg) {
      throw new Error('backends not opened');
    }

    for (const b of backends) {
      await applyNotesSchema(
        b.client,
        b.name === 'postgres-mem' ? 'postgres' : 'sqlite'
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

  test('postgres-mem int8 rows coerce bigint to number', async () => {
    const pg = backends.find((b) => b.name === 'postgres-mem');
    if (pg === undefined) throw new Error('postgres-mem backend missing');
    const rows = await pg.client.query<{ n: number }>(sql`
      SELECT 42::int8 AS n
    `);
    expect(rows[0]?.n).toBe(42);
    expect(typeof rows[0]?.n).toBe('number');
    expect(() => JSON.stringify(rows)).not.toThrow();
    expect(Math.max(0, rows[0]!.n)).toBe(42);
  });
});
