import { expect, test } from 'bun:test';
import { openMemServerSql } from '@libs/harness-ts/sql-backend-mem';
import { sqlDataCheckpoint } from '@libs/harness-ts/sql-data-checkpoint';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres-shared-ts/reconcile-postgres-schema';
import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { SqlClientImplPg } from '@pkgs/sql-client-postgres-shared-ts/impl-pg';
import { createPostgresDbScope } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';
import sql from '@pkgs/sql-root-shared-ts/sql';

test('a Postgres checkpoint retains its dialect inside a transaction', async () => {
  // regression: postgres-checkpoint-loses-transaction-scope
  const server = openMemServerSql('checkpoint', { now: () => 1000 });
  const scope = createPostgresDbScope('public');
  const db = new SqlClientImplPg(server.pool!, scope);
  const table = defineTable({
    domain: 'checkpoint',
    name: 'checkpoint_people',
    columns: { name: 'text' },
  });
  try {
    await server.sqlClient.connect();
    await db.connect();
    await reconcilePostgresSchema(db, registerTables([table]), scope, {
      skipAdvisoryLock: true,
      indexPhase: 'inline',
    });
    await db.run(
      sql`INSERT INTO checkpoint_people (id, name) VALUES (${'alice'}, ${'Alice'})`
    );
    const checkpoint = sqlDataCheckpoint(db);
    const bytes = await checkpoint.exportBytes();
    await db.run(
      sql`UPDATE checkpoint_people SET name = ${'Changed'} WHERE id = ${'alice'}`
    );
    await checkpoint.importBytes(bytes);
    expect(
      await db.query(sql<{ name: string }>`SELECT name FROM checkpoint_people`)
    ).toEqual([{ name: 'Alice' }]);
  } finally {
    await server.disconnect();
  }
});

test('a Postgres checkpoint loads a canonical JSON array as JSON', async () => {
  // regression: postgres-checkpoint-json-array
  const server = openMemServerSql('json-checkpoint', { now: () => 1000 });
  const scope = createPostgresDbScope('public');
  const db = new SqlClientImplPg(server.pool!, scope);
  const table = defineTable({
    domain: 'checkpoint',
    name: 'checkpoint_choices',
    columns: { choices: 'json' },
  });
  try {
    await server.sqlClient.connect();
    await db.connect();
    await reconcilePostgresSchema(db, registerTables([table]), scope, {
      skipAdvisoryLock: true,
      indexPhase: 'inline',
    });
    const dump = {
      version: 1,
      tables: {
        checkpoint_choices: {
          columns: ['id', 'choices'],
          rows: [['alice', ['e2e4', 'e7e5']]],
        },
      },
    };
    await sqlDataCheckpoint(db).importBytes(
      new TextEncoder().encode(JSON.stringify(dump))
    );
    const rows = await db.query(
      sql<{
        first_choice: string;
        second_choice: string;
      }>`SELECT choices->>0 AS first_choice, choices->>1 AS second_choice FROM checkpoint_choices`
    );
    expect(rows).toEqual([{ first_choice: 'e2e4', second_choice: 'e7e5' }]);
  } finally {
    await server.disconnect();
  }
});
