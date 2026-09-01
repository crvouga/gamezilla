/**
 * Live Postgres contract (ambient `DATABASE_URL` — `@pkgs/postgres-embedded` or
 * secrets-run). Excluded from default unit speed when URL unset.
 */
import { describe, expect, test } from 'bun:test';
import { raw } from '@pkgs/sql';
import {
  createPgPool,
  ensurePostgresSchema,
  isLoopbackPostgresUrl,
  openPgClient,
} from './connect';
import { SqlClientImplBunPostgres } from './impl-bun-postgres';
import { createPostgresDbScope } from './schema';

const DATABASE_URL = process.env['DATABASE_URL'] ?? '';
const HAS_DB = DATABASE_URL.length > 0;
const TEST_SCHEMA = 'gamezilla_test_scope';
const REMOTE_DB_TIMEOUT_MS = 30_000;

describe.skipIf(!HAS_DB)('postgres-connect (DATABASE_URL contract)', () => {
  const dbScope = createPostgresDbScope(TEST_SCHEMA);

  test('DATABASE_URL is a postgres wire URL', () => {
    expect(
      DATABASE_URL.startsWith('postgres://') ||
        DATABASE_URL.startsWith('postgresql://')
    ).toBe(true);
    expect(typeof isLoopbackPostgresUrl(DATABASE_URL)).toBe('boolean');
  });

  test(
    'ensurePostgresSchema skips CREATE SCHEMA for public',
    async () => {
      const publicScope = createPostgresDbScope('public');
      const { pool, sqlClient } = createPgPool({
        connectionString: DATABASE_URL,
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
    { timeout: REMOTE_DB_TIMEOUT_MS }
  );

  test(
    'ensurePostgresSchema creates the schema and is idempotent',
    async () => {
      const { pool, sqlClient } = createPgPool({
        connectionString: DATABASE_URL,
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
    { timeout: REMOTE_DB_TIMEOUT_MS }
  );

  test(
    'createPgPool pins every pooled connection to the schema',
    async () => {
      const { pool, sqlClient } = createPgPool({
        connectionString: DATABASE_URL,
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
    { timeout: REMOTE_DB_TIMEOUT_MS }
  );

  test(
    'openPgClient pins the session and can self-bootstrap the schema',
    async () => {
      const { client, sqlClient } = await openPgClient({
        connectionString: DATABASE_URL,
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
    { timeout: REMOTE_DB_TIMEOUT_MS }
  );

  test(
    'SqlClientImplBunPostgres pins every query on Neon pooler URLs',
    async () => {
      const sqlClient = SqlClientImplBunPostgres.connect(DATABASE_URL, dbScope);
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
        await sqlClient.disconnect();
      }
    },
    { timeout: REMOTE_DB_TIMEOUT_MS }
  );

  test(
    'int8 rows are JSON-safe (no bigint) on pool + client',
    async () => {
      const { pool, sqlClient } = createPgPool({
        connectionString: DATABASE_URL,
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
          connectionString: DATABASE_URL,
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
    { timeout: REMOTE_DB_TIMEOUT_MS }
  );
});
