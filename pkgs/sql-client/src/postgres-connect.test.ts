import { afterAll, describe, expect, test } from 'bun:test';
import {
  createPgPool,
  ensurePostgresSchema,
  openPgClient,
} from './postgres-connect';
import {
  GAMEZILLA_POSTGRES_SCHEMA,
  gamezillaPostgresDbScope,
  quotePgIdent,
} from './postgres-schema';
import { withPostgresSearchPathOption } from './postgres-session-schema';

const DATABASE_URL = process.env['DATABASE_URL'] ?? '';
const HAS_DB = DATABASE_URL.length > 0;

describe('postgres-schema', () => {
  test('scope schema is the canonical gamezilla constant', () => {
    expect(gamezillaPostgresDbScope().schema).toBe(GAMEZILLA_POSTGRES_SCHEMA);
    expect(GAMEZILLA_POSTGRES_SCHEMA).toBe('gamezilla');
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
      gamezillaPostgresDbScope()
    );
    const url = new URL(out);
    expect(url.searchParams.get('options')).toBe('-c search_path=gamezilla');
    expect(url.searchParams.get('sslmode')).toBe('disable');
  });

  test('returns the input unchanged when it is not a URL', () => {
    const out = withPostgresSearchPathOption(
      'not a url',
      gamezillaPostgresDbScope()
    );
    expect(out).toBe('not a url');
  });
});

describe.skipIf(!HAS_DB)('postgres-connect (DATABASE_URL)', () => {
  const dbScope = gamezillaPostgresDbScope();
  const pools: Array<{ end: () => Promise<void> }> = [];

  afterAll(async () => {
    for (const pool of pools) await pool.end().catch(() => {});
  });

  test('ensurePostgresSchema creates the schema and is idempotent', async () => {
    const { pool, sqlClient } = createPgPool({
      connectionString: DATABASE_URL,
      dbScope,
    });
    pools.push(pool);
    await ensurePostgresSchema(sqlClient, dbScope);
    // Second call must not throw (CREATE SCHEMA IF NOT EXISTS).
    await ensurePostgresSchema(sqlClient, dbScope);
    const rows = await sqlClient.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'gamezilla') AS exists"
    );
    expect(rows[0]?.exists).toBe(true);
  });

  test('createPgPool pins every pooled connection to the schema', async () => {
    const { pool, sqlClient } = createPgPool({
      connectionString: DATABASE_URL,
      dbScope,
      max: 3,
    });
    pools.push(pool);
    await ensurePostgresSchema(sqlClient, dbScope);
    for (let i = 0; i < 6; i++) {
      const rows = await sqlClient.query<{ current_schema: string }>(
        'SELECT current_schema() AS current_schema'
      );
      expect(rows[0]?.current_schema).toBe('gamezilla');
    }
  });

  test('openPgClient pins the session and can self-bootstrap the schema', async () => {
    const { client, sqlClient } = await openPgClient({
      connectionString: DATABASE_URL,
      dbScope,
      ensureSchema: true,
    });
    try {
      const rows = await sqlClient.query<{ current_schema: string }>(
        'SELECT current_schema() AS current_schema'
      );
      expect(rows[0]?.current_schema).toBe('gamezilla');
    } finally {
      await client.end();
    }
  });
});
