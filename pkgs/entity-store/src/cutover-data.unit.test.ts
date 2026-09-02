/**
 * Pin: portable TEXT entity_store.data must rebuild onto jsonb before
 * PostgresSchema reconcile (type mismatch is drift, not ALTER TYPE).
 */
import { describe, expect, test } from 'bun:test';
import { createNoopLogger } from '@pkgs/logger';
import { unsafe } from '@pkgs/sql';
import { SqlClientImplPostgresMem } from '@pkgs/sql-client/postgres/impl-postgres-mem';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres/schema';

import { EntityStorePostgresDatabaseMigration } from './postgres-database-migration';

const LEGACY_DDL = [
  'CREATE',
  'TABLE',
  'entity_store (',
  '  id text PRIMARY KEY,',
  '  namespace text NOT NULL,',
  '  type text NOT NULL,',
  '  external_id text NOT NULL,',
  '  owner_id text,',
  '  data text NOT NULL,',
  '  created_at text NOT NULL',
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
        AND table_name = 'entity_store'
    `)
  );
  return Object.fromEntries(rows.map((r) => [r.column_name, r.udt_name]));
}

describe('entity_store cutover', () => {
  test('rebuilds TEXT data onto jsonb then reconciles', async () => {
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
          INSERT INTO entity_store (
            id, namespace, type, external_id, owner_id, data, created_at
          ) VALUES (
            'n:t:x', 'ns', 't', 'x', NULL, '{"n":1}',
            '2020-01-01T00:00:00.000Z'
          )
        `)
      );

      const migration = new EntityStorePostgresDatabaseMigration({
        skipAdvisoryLock: true,
        alreadyInTransaction: true,
      });
      const ctx = { sqlClient: client, logger: createNoopLogger() };
      await migration.migrate(ctx);
      await migration.migrate(ctx);

      const types = await columnUdts(client);
      expect(types['data']).toBe('jsonb');
      expect(types['created_at']).toBe('timestamptz');
      expect(types['updated_at']).toBe('timestamptz');
      expect(types['deleted_at']).toBe('timestamptz');

      const rows = await client.query<{ type: string }>(
        unsafe(`SELECT type FROM entity_store WHERE id = 'n:t:x'`)
      );
      expect(rows[0]?.type).toBe('t');
    } finally {
      await client.disconnect();
    }
  });
});
