import { afterEach, describe, expect, test } from 'bun:test';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres-shared/reconcile-postgres-schema';
import { defineTable } from '@pkgs/db-schema-root-shared/define-table';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';
import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres-server/impl-mockingbird-postgres';
import sql, { ident } from '@pkgs/sql-root-shared/sql';

const TS = '2020-01-01T00:00:00.000Z';

const openClients: SqlClientImplMockingbirdPostgres[] = [];

afterEach(async () => {
  while (openClients.length > 0) {
    const client = openClients.pop();
    if (client) await client.disconnect();
  }
});

describe('repairMockingbirdPostgresPgmmBigintSlots', () => {
  test('PGMM round-trip SELECT * of timestamptz and int8 n+1 do not mix', async () => {
    const client = SqlClientImplMockingbirdPostgres.open({
      seed: 1,
      now: () => new Date(TS),
    });
    openClients.push(client);
    await client.connect();
    await reconcilePostgresSchema(
      client,
      registerTables([
        defineTable({
          domain: 'auth',
          name: 'auth_devices',
          columns: {
            platform: 'text',
            first_seen_at: 'timestamp',
          },
        }),
        defineTable({
          domain: 'seq',
          name: 'seq_n',
          columns: { topic: 'text', n: 'integer' },
          uniqueIndexes: ['topic'],
        }),
      ]),
      client.dbScope,
      { skipAdvisoryLock: true }
    );
    await client.run(sql`
      INSERT INTO auth_devices (
        id, platform, first_seen_at, created_at, updated_at, deleted_at
      ) VALUES (
        ${'dev-1'}, ${'web'}, ${TS}, ${TS}, ${TS}, ${null}
      )
    `);
    await client.run(sql`
      INSERT INTO seq_n (id, topic, n, created_at, updated_at, deleted_at)
      VALUES (${'s1'}, ${'t'}, ${1}, ${TS}, ${TS}, ${null})
    `);

    const bytes = client.exportDatabaseBytes();
    const restored = SqlClientImplMockingbirdPostgres.open({
      seed: 1,
      now: () => new Date(TS),
    });
    openClients.push(restored);
    await restored.connect();
    restored.importDatabaseBytes(bytes);

    const devices = await restored.query<Record<string, unknown>>(
      sql`SELECT * FROM ${ident('auth_devices')}`
    );
    expect(devices).toHaveLength(1);
    expect(devices[0]?.['id']).toBe('dev-1');
    expect(devices[0]?.['platform']).toBe('web');
    expect(typeof devices[0]?.['created_at']).toBe('string');
    expect(typeof devices[0]?.['first_seen_at']).toBe('string');

    const bumped = await restored.query<{ x: number }>(
      sql`SELECT n + 1 AS x FROM ${ident('seq_n')}`
    );
    expect(Number(bumped[0]?.x)).toBe(2);
  });
});
