// Cached Postgres contracts use a private embedded server, never an injected database.

import { afterAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { freePostgresPort } from '@pkgs/postgres-mockingbird-server-ts/free-port';
import { startMockingbirdPostgres } from '@pkgs/postgres-mockingbird-server-ts/start';
import {
  createPgPool,
  isLoopbackPostgresUrl,
  openPgClient,
} from '@pkgs/sql-client-postgres-server-ts/connect';
import { SqlClientImplBunPostgres } from '@pkgs/sql-client-postgres-server-ts/impl-bun-postgres';
import { ensurePostgresSchema } from '@pkgs/sql-client-postgres-shared-ts/ensure-schema';
import { createPostgresDbScope } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';
import { raw } from '@pkgs/sql-root-shared-ts/sql';

const TEST_SCHEMA = 'acme_test_scope';
const REMOTE_DB_TIMEOUT_MS = 30_000;
const dbScope = createPostgresDbScope(TEST_SCHEMA);

const pg = await startMockingbirdPostgres({
  port: await freePostgresPort(),
  dataDir: join(tmpdir(), `pg-contract-${randomUUID()}`),
});
const databaseUrl = pg.url;

afterAll(async () => {
  await pg.stop();
});

describe('postgres-connect (DATABASE_URL contract)', () => {
  // regression: cached-contract-external-credentials
  test('injected DATABASE_URL cannot select an external fixture', () => {
    expect(isLoopbackPostgresUrl(databaseUrl)).toBe(true);
  });
  test('DATABASE_URL is a postgres wire URL', () => {
    expect(
      databaseUrl.startsWith('postgres://') ||
        databaseUrl.startsWith('postgresql://')
    ).toBe(true);
    expect(typeof isLoopbackPostgresUrl(databaseUrl)).toBe('boolean');
  });

  test(
    'ensurePostgresSchema skips CREATE SCHEMA for public',
    async () => {
      const publicScope = createPostgresDbScope('public');
      const { pool, sqlClient } = createPgPool({
        connectionString: databaseUrl,
        dbScope: publicScope,
        max: 1,
      });
      try {
        await ensurePostgresSchema(sqlClient, publicScope);
        const rows = await sqlClient.query(
          raw<{ current_schema: string | null }>(
            'SELECT current_schema() AS current_schema'
          )
        );
        const current = rows[0]?.current_schema ?? null;
        expect(current === 'public' || current === null).toBe(true);
      } finally {
        await pool.end();
      }
    },
    REMOTE_DB_TIMEOUT_MS
  );

  // regression: mockingbird-postgres-startup-search-path
  test(
    'ensurePostgresSchema creates the schema and is idempotent',
    async () => {
      const { pool, sqlClient } = createPgPool({
        connectionString: databaseUrl,
        dbScope,
        max: 1,
      });
      try {
        await ensurePostgresSchema(sqlClient, dbScope);
        await ensurePostgresSchema(sqlClient, dbScope);
        const rows = await sqlClient.query(
          raw<{ exists: boolean }>(
            `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = '${TEST_SCHEMA}') AS exists`
          )
        );
        expect(rows[0]?.exists).toBe(true);
      } finally {
        await pool.end();
      }
    },
    REMOTE_DB_TIMEOUT_MS
  );

  test(
    'createPgPool pins every pooled connection to the schema',
    async () => {
      const { pool, sqlClient } = createPgPool({
        connectionString: databaseUrl,
        dbScope,
        max: 1,
      });
      try {
        await ensurePostgresSchema(sqlClient, dbScope);
        for (let i = 0; i < 3; i++) {
          const rows = await sqlClient.query(
            raw<{ current_schema: string }>(
              'SELECT current_schema() AS current_schema'
            )
          );
          expect(rows[0]?.current_schema).toBe(TEST_SCHEMA);
        }
      } finally {
        await pool.end();
      }
    },
    REMOTE_DB_TIMEOUT_MS
  );

  // regression: postgres-pool-missing-schema-hook
  test('new pooled sessions are pinned before concurrent checkout', async () => {
    const { pool, sqlClient } = createPgPool({
      connectionString: databaseUrl,
      dbScope,
      max: 3,
    });
    try {
      await ensurePostgresSchema(sqlClient, dbScope);
      const clients = await Promise.all([
        pool.connect(),
        pool.connect(),
        pool.connect(),
      ]);
      try {
        const results = await Promise.all(
          clients.map((client) =>
            client.query('SELECT current_schema() AS current_schema')
          )
        );
        expect(results.map((result) => result.rows[0]?.current_schema)).toEqual(
          [TEST_SCHEMA, TEST_SCHEMA, TEST_SCHEMA]
        );
      } finally {
        for (const client of clients) client.release();
      }
    } finally {
      await pool.end();
    }
  });

  test(
    'openPgClient pins the session and can self-bootstrap the schema',
    async () => {
      const { client, sqlClient } = await openPgClient({
        connectionString: databaseUrl,
        dbScope,
        ensureSchema: true,
      });
      try {
        const rows = await sqlClient.query(
          raw<{ current_schema: string }>(
            'SELECT current_schema() AS current_schema'
          )
        );
        expect(rows[0]?.current_schema).toBe(TEST_SCHEMA);
      } finally {
        await client.end();
      }
    },
    REMOTE_DB_TIMEOUT_MS
  );

  // regression: postgres-bun-startup-option-ignored
  // regression: postgres-bun-contract-shared-session-state
  test(
    'SqlClientImplBunPostgres pins every query to its schema',
    async () => {
      const bunPg = await startMockingbirdPostgres({
        port: 0,
        dataDir: join(tmpdir(), `pg-bun-contract-${randomUUID()}`),
      });
      const sqlClient = SqlClientImplBunPostgres.connect(bunPg.url, dbScope);
      try {
        await sqlClient.connect();
        await ensurePostgresSchema(sqlClient, dbScope);
        for (let i = 0; i < 3; i++) {
          const rows = await sqlClient.query(
            raw<{ current_schema: string }>(
              'SELECT current_schema() AS current_schema'
            )
          );
          expect(rows[0]?.current_schema).toBe(TEST_SCHEMA);
        }
      } finally {
        try {
          await sqlClient.disconnect();
        } finally {
          await bunPg.stop();
        }
      }
    },
    REMOTE_DB_TIMEOUT_MS
  );

  test(
    'int8 rows are JSON-safe (no bigint) on pool + client',
    async () => {
      const { pool, sqlClient } = createPgPool({
        connectionString: databaseUrl,
        dbScope,
        max: 1,
      });
      try {
        await ensurePostgresSchema(sqlClient, dbScope);
        const rows = await sqlClient.query<{ n: number | string }>(
          raw(`SELECT 42::int8 AS n`)
        );
        expect(typeof rows[0]?.n).not.toBe('bigint');
        expect(() => JSON.stringify(rows)).not.toThrow();
        expect(Math.max(0, Number(rows[0]?.n))).toBe(42);

        const { client, sqlClient: oneShot } = await openPgClient({
          connectionString: databaseUrl,
          dbScope,
          ensureSchema: true,
        });
        try {
          const again = await oneShot.query<{ n: number | string }>(
            raw(`SELECT 42::int8 AS n`)
          );
          expect(typeof again[0]?.n).not.toBe('bigint');
          expect(() => JSON.stringify(again)).not.toThrow();
        } finally {
          await client.end();
        }
      } finally {
        await pool.end();
      }
    },
    REMOTE_DB_TIMEOUT_MS
  );
});
