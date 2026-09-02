/**
 * Pin: portable TEXT write_rejections must rebuild onto jsonb/timestamptz
 * before PostgresSchema reconcile (type mismatch is drift, not ALTER TYPE).
 */
import { describe, expect, test } from 'bun:test';
import { createNoopLogger } from '@pkgs/logger';
import { unsafe } from '@pkgs/sql';
import { SqlClientImplPostgresMem } from '@pkgs/sql-client/postgres/impl-postgres-mem';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres/schema';

import { SyncEngineDatabaseMigration } from '../../shared/sync-engine-database-migration';

const LEGACY_DDL = [
  'CREATE',
  'TABLE',
  'sync_engine_write_rejections (',
  '  id text PRIMARY KEY,',
  '  mutation_id text NOT NULL,',
  '  client_id text NOT NULL,',
  '  code text NOT NULL,',
  '  message text NOT NULL,',
  '  meta text,',
  '  created_at text NOT NULL,',
  '  acknowledged integer NOT NULL',
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
        AND table_name = 'sync_engine_write_rejections'
    `)
  );
  return Object.fromEntries(rows.map((r) => [r.column_name, r.udt_name]));
}

describe('sync-engine write_rejections cutover', () => {
  test('rebuilds TEXT columns onto jsonb/timestamptz then reconciles', async () => {
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
          INSERT INTO sync_engine_write_rejections (
            id, mutation_id, client_id, code, message, meta, created_at,
            acknowledged
          ) VALUES (
            'r1', 'm1', 'c1', 'CODE', 'nope', '{"k":1}',
            '2020-01-01T00:00:00.000Z', 0
          )
        `)
      );

      const migration = new SyncEngineDatabaseMigration({
        skipAdvisoryLock: true,
        alreadyInTransaction: true,
      });
      const ctx = { sqlClient: client, logger: createNoopLogger() };
      await migration.migrate(ctx);
      await migration.migrate(ctx);

      const types = await columnUdts(client);
      expect(types['meta']).toBe('jsonb');
      expect(types['created_at']).toBe('timestamptz');
      expect(types['updated_at']).toBe('timestamptz');
      expect(types['deleted_at']).toBe('timestamptz');

      const rows = await client.query<{ mutation_id: string }>(
        unsafe(
          `SELECT mutation_id FROM sync_engine_write_rejections WHERE id = 'r1'`
        )
      );
      expect(rows[0]?.mutation_id).toBe('m1');
    } finally {
      await client.disconnect();
    }
  });
});
