import { describe, expect, test } from 'bun:test';
import { raw } from '@pkgs/sql';
import {
  createPgPool,
  ensurePostgresSchema,
  isLoopbackPostgresUrl,
  openPgClient,
} from './connect';
import { SqlClientImplBunPostgres } from './impl-bun-postgres';
import { createPostgresDbScope, quotePgIdent } from './schema';
import {
  postgresRejectsStartupSearchPathOption,
  withPostgresSearchPathOption,
} from './session-schema';

const DATABASE_URL = process.env['DATABASE_URL'] ?? '';
const HAS_DB = DATABASE_URL.length > 0;
const TEST_SCHEMA = 'gamezilla_test_scope';
/** Remote Neon round-trips often take 2–4s; parallel `bun check` can push past 5s. */
const REMOTE_DB_TIMEOUT_MS = 30_000;

describe('postgres-schema', () => {
  test('scope carries the injected schema name', () => {
    const scope = createPostgresDbScope('my_app');
    expect(scope.schema).toBe('my_app');
  });

  test('quotePgIdent double-quotes and escapes embedded quotes', () => {
    expect(quotePgIdent('gamezilla')).toBe('"gamezilla"');
    expect(quotePgIdent('we"ird')).toBe('"we""ird"');
  });
});

describe('withPostgresSearchPathOption', () => {
  test('pins search_path via the libpq startup options parameter', () => {
    const out = withPostgresSearchPathOption(
      'postgres://u:p@host:5432/db?sslmode=disable',
      createPostgresDbScope('my_app')
    );
    const url = new URL(out);
    expect(url.searchParams.get('options')).toBe('-c search_path=my_app');
    expect(url.searchParams.get('sslmode')).toBe('disable');
  });

  test('returns the input unchanged when it is not a URL', () => {
    const out = withPostgresSearchPathOption(
      'not a url',
      createPostgresDbScope('my_app')
    );
    expect(out).toBe('not a url');
  });

  test('skips startup options on Neon pooler hosts', () => {
    const input =
      'postgres://u:p@ep-cool-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require';
    expect(postgresRejectsStartupSearchPathOption(input)).toBe(true);
    const out = withPostgresSearchPathOption(
      input,
      createPostgresDbScope('my_app')
    );
    expect(out).toBe(input);
    expect(new URL(out).searchParams.get('options')).toBeNull();
  });
});

// These hit the ambient `DATABASE_URL` (secrets-run Infisical and/or local
// `@apps/postgres`). Keep the connection footprint minimal (`max: 1`, each
// pool closed in its own `finally`).
describe.skipIf(!HAS_DB)('postgres-connect (DATABASE_URL)', () => {
  const dbScope = createPostgresDbScope(TEST_SCHEMA);

  test('DATABASE_URL is a postgres wire URL', () => {
    expect(
      DATABASE_URL.startsWith('postgres://') ||
        DATABASE_URL.startsWith('postgresql://')
    ).toBe(true);
    // Loopback (`@apps/postgres`) and hosted Neon are both valid for SECRETS_ENV=dev.
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
        // Second call must not throw (CREATE SCHEMA IF NOT EXISTS).
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
});
