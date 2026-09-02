/**
 * Pin: portable TEXT kv.value must rebuild onto jsonb before PostgresSchema
 * reconcile (type mismatch is drift, not ALTER TYPE).
 */
import { describe, expect, test } from 'bun:test';
import { createNoopLogger } from '@pkgs/logger';
import { unsafe } from '@pkgs/sql';
import { SqlClientImplPostgresMem } from '@pkgs/sql-client/postgres/impl-postgres-mem';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres/schema';

import { KvPostgresDatabaseMigration } from './postgres-database-migration';

const LEGACY_DDL = [
  'CREATE',
  'TABLE',
  'kv (',
  '  key text PRIMARY KEY,',
  '  value text NOT NULL,',
  '  last_modified_at text',
  ')',
].join(' ');

async function columnUdts(
  client: SqlClientImplPostgresMem
): Promise<Record<string, string>> {
  const rows = await client.query<{ column_name: string; udt_name: string }>(
    unsafe(`
      SELECT column_name, udt_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'kv'
    `)
  );
  return Object.fromEntries(rows.map((r) => [r.column_name, r.udt_name]));
}

describe('kv cutover', () => {
  test('rebuilds TEXT value onto jsonb then reconciles', async () => {
    const client = SqlClientImplPostgresMem.open({
      seed: 1,
      now: () => new Date('2020-01-01T00:00:00.000Z'),
      dbScope: createPostgresDbScope('public'),
    });
    await client.connect();
    try {
      await client.run(unsafe(LEGACY_DDL));
      await client.run(
        unsafe(`
          INSERT INTO kv (key, value, last_modified_at) VALUES
            ('ns:k1', '{"a":1}', '2020-01-01T00:00:00.000Z'),
            ('ns:empty', '', '2020-01-01T00:00:00.000Z'),
            ('ns:ws', '   ', '2020-01-01T00:00:00.000Z'),
            ('ns:trunc', '{', '2020-01-01T00:00:00.000Z')
        `)
      );

      const migration = new KvPostgresDatabaseMigration({
        skipAdvisoryLock: true,
        alreadyInTransaction: true,
      });
      const ctx = { sqlClient: client, logger: createNoopLogger() };
      await migration.migrate(ctx);
      await migration.migrate(ctx);

      const types = await columnUdts(client);
      expect(types['value']).toBe('jsonb');
      expect(types['created_at']).toBe('timestamptz');
      expect(types['id']).toBe('text');

      const rows = await client.query<{ key: string; value: unknown }>(
        unsafe(
          `SELECT key, value FROM kv WHERE id IN ('ns:k1', 'ns:empty', 'ns:ws', 'ns:trunc')`
        )
      );
      const byKey = Object.fromEntries(rows.map((r) => [r.key, r.value]));
      const k1 = byKey['ns:k1'];
      const parsed =
        typeof k1 === 'string' ? (JSON.parse(k1) as { a: number }) : k1;
      expect(parsed).toEqual({ a: 1 });
      expect(byKey['ns:empty']).toBeNull();
      expect(byKey['ns:ws']).toBeNull();
      expect(byKey['ns:trunc']).toBeDefined();
      expect(byKey['ns:trunc']).not.toBeNull();
    } finally {
      await client.disconnect();
    }
  });
});
