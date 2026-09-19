// goal:the-bar:5 — Postgres connection contract runs against real PG.

import { afterAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startEmbeddedPostgres } from '@pkgs/postgres-embedded';
import { raw } from '@pkgs/sql';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { createPgPool, openPgClient } from './connect';
import { ensurePostgresSchema } from './ensure-schema';
import { SqlClientImplBunPostgres } from './impl-bun-postgres';

const TEST_SCHEMA = 'gamezilla_test_scope';
const REMOTE_DB_TIMEOUT_MS = 30_000;
const dbScope = createPostgresDbScope(TEST_SCHEMA);
let databaseUrl = process.env['DATABASE_URL'] ?? '';
let stopPg: (() => Promise<void>) | undefined;

if (databaseUrl.length === 0) {
  const pg = await startEmbeddedPostgres({
    dataDir: join(tmpdir(), `pg-contract-${randomUUID()}`),
  });
  databaseUrl = pg.url;
  stopPg = pg.stop;
}

afterAll(async () => {
  await stopPg?.();
});

describe('postgres-connect (DATABASE_URL contract)', () => {
  test('database URL is a PostgreSQL wire URL', () => {
    expect(databaseUrl).toMatch(/^postgres(?:ql)?:\/\//);
  });

  test(
    'pool pins every connection to the requested schema',
    async () => {
      const { pool } = createPgPool({
        connectionString: databaseUrl,
        dbScope,
        max: 1,
      });
      try {
        await pool.query(`CREATE SCHEMA IF NOT EXISTS "${TEST_SCHEMA}"`);
        const result = await pool.query('SELECT current_schema() AS schema');
        expect(result.rows[0]?.schema).toBe(TEST_SCHEMA);
      } finally {
        await pool.end();
      }
    },
    REMOTE_DB_TIMEOUT_MS
  );

  test(
    'open client bootstraps and pins its schema',
    async () => {
      const opened = await openPgClient({
        connectionString: databaseUrl,
        dbScope,
        ensureSchema: true,
      });
      try {
        const rows = await opened.sqlClient.query<{ schema: string }>(
          raw('SELECT current_schema() AS schema')
        );
        expect(rows[0]?.schema).toBe(TEST_SCHEMA);
        await ensurePostgresSchema(opened.sqlClient, dbScope);
      } finally {
        await opened.sqlClient.disconnect();
      }
    },
    REMOTE_DB_TIMEOUT_MS
  );

  test(
    'Bun Postgres adapter returns JSON-safe int8 rows',
    async () => {
      const impl = SqlClientImplBunPostgres.connect(databaseUrl, dbScope);
      await impl.connect();
      try {
        await impl.run(
          raw('CREATE TABLE IF NOT EXISTS contract_int8 (value BIGINT)')
        );
        await impl.run(raw('TRUNCATE contract_int8'));
        await impl.run(
          raw('INSERT INTO contract_int8 (value) VALUES (9007199254740991)')
        );
        const rows = await impl.query<{ value: number | string }>(
          raw('SELECT value FROM contract_int8')
        );
        expect(String(rows[0]?.value)).toBe('9007199254740991');
        await impl.run(raw('DROP TABLE contract_int8'));
      } finally {
        await impl.disconnect();
      }
    },
    REMOTE_DB_TIMEOUT_MS
  );
});
