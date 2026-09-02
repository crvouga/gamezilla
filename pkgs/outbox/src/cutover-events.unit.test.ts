/**
 * Pin: portable TEXT outbox_events must rebuild onto jsonb/timestamptz
 * before PostgresSchema reconcile (type mismatch is drift, not ALTER TYPE).
 */
import { describe, expect, test } from 'bun:test';
import { createNoopLogger } from '@pkgs/logger';
import { unsafe } from '@pkgs/sql';
import { SqlClientImplPostgresMem } from '@pkgs/sql-client/postgres/impl-postgres-mem';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres/schema';

import { OutboxDatabaseMigration } from './migrate';

const LEGACY_DDL = [
  'CREATE',
  'TABLE',
  'outbox_events (',
  '  id text PRIMARY KEY,',
  '  type text NOT NULL,',
  '  payload text NOT NULL,',
  '  available_at text NOT NULL,',
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
        AND table_name = 'outbox_events'
    `)
  );
  return Object.fromEntries(rows.map((r) => [r.column_name, r.udt_name]));
}

describe('outbox events cutover', () => {
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
          INSERT INTO outbox_events (
            id, type, payload, available_at, created_at
          ) VALUES (
            'e1', 'ping', '{"n":1}',
            '2020-01-01T00:00:00.000Z', '2020-01-01T00:00:00.000Z'
          )
        `)
      );

      const migration = new OutboxDatabaseMigration({
        skipAdvisoryLock: true,
        alreadyInTransaction: true,
      });
      const ctx = { sqlClient: client, logger: createNoopLogger() };
      await migration.migrate(ctx);
      await migration.migrate(ctx);

      const types = await columnUdts(client);
      expect(types['payload']).toBe('jsonb');
      expect(types['available_at']).toBe('timestamptz');
      expect(types['created_at']).toBe('timestamptz');
      expect(types['updated_at']).toBe('timestamptz');
      expect(types['deleted_at']).toBe('timestamptz');

      const rows = await client.query<{ type: string }>(
        unsafe(`SELECT type FROM outbox_events WHERE id = 'e1'`)
      );
      expect(rows[0]?.type).toBe('ping');
    } finally {
      await client.disconnect();
    }
  });
});
