/**
 * Portable SQL corpus: the same DML runs on sqlite-mem and PGlite (+ JSON1
 * compat). Lives here so `@pkgs/postgres-sqlite-compat` stays a leaf.
 */
import { afterAll, describe, expect, test } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { installPostgresSqliteCompat } from '@pkgs/postgres-sqlite-compat';
import { sql } from '@pkgs/sql';
import type { SqlClient } from '../interface';
import { SqlClientImplSqliteMem } from '../sqlite/impl-sqlite-mem';
import { createPgliteSqlClient } from './impl-pglite';

type Backend = {
  readonly name: string;
  readonly client: SqlClient;
  close(): Promise<void>;
};

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

  afterAll(async () => {
    for (const b of backends) await b.close();
  });

  test('insert/select/soft-delete timestamps agree', async () => {
    const sqlite = await openSqliteMem();
    const pg = await openPglite();
    backends.push(sqlite, pg);

    for (const b of [sqlite, pg]) {
      await b.client.run(sql`
        CREATE TABLE notes (
          id TEXT PRIMARY KEY,
          body TEXT NOT NULL,
          deleted_at INTEGER
        )
      `);
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
});
