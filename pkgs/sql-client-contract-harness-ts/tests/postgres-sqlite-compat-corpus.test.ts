/**
 * Portable SQL corpus: the same DML runs on mockingbird-sqlite and mockingbird-postgres
 * (+ JSON1 compat). Lives here so `@pkgs/postgres-sqlite-compat-shared-ts` stays a leaf.
 */
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres-shared-ts/reconcile-postgres-schema';
import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres-server-ts/impl-mockingbird-postgres';
import type {
  PostgresSqlClient,
  SqlClient,
} from '@pkgs/sql-client-root-shared-ts/interface';
import { createPostgresDbScope } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';

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
    await reconcilePostgresSchema(
      client,
      notesSchema,
      postgresDbScope(client),
      {
        skipAdvisoryLock: true,
      }
    );
    return;
  }
  await reconcileSqliteSchema(client, notesSchema);
}

async function openMockingbirdSqlite(): Promise<Backend> {
  const client = SqlClientImplMockingbirdSqlite.open();
  await client.connect();
  return {
    name: 'mockingbird-sqlite',
    client,
    close: () => client.disconnect(),
  };
}

async function openMockingbirdPostgres(): Promise<Backend> {
  const client = SqlClientImplMockingbirdPostgres.open({
    seed: 1,
    dbScope: createPostgresDbScope('public'),
  });
  await client.connect();
  return {
    name: 'mockingbird-postgres',
    client,
    close: () => client.disconnect(),
  };
}

describe('portable SQL corpus', () => {
  const backends: Backend[] = [];

  beforeAll(async () => {
    backends.push(
      await openMockingbirdSqlite(),
      await openMockingbirdPostgres()
    );
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
        b.name === 'mockingbird-postgres' ? 'postgres' : 'sqlite'
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

  test('mockingbird-postgres int8 rows coerce bigint to number', async () => {
    const pg = backends.find((b) => b.name === 'mockingbird-postgres');
    if (pg === undefined)
      throw new Error('mockingbird-postgres backend missing');
    const rows = await pg.client.query<{ n: number }>(sql`
      SELECT 42::int8 AS n
    `);
    expect(rows[0]?.n).toBe(42);
    expect(typeof rows[0]?.n).toBe('number');
    expect(() => JSON.stringify(rows)).not.toThrow();
    expect(Math.max(0, rows[0]!.n)).toBe(42);
  });
});
