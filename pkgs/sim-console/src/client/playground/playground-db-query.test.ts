import { afterEach, describe, expect, test } from 'bun:test';
import { defineTable, registerTables } from '@pkgs/db-schema';
import { applyPostgresSchema } from '@pkgs/db-schema/postgres';
import { sql } from '@pkgs/sql';
import { SqlClientImplPostgresMem } from '@pkgs/sql-client/postgres/impl-postgres-mem';

import { loadPlaygroundTablePage } from './playground-db-query';

const TS = '2020-01-01T00:00:00.000Z';

const openClients: SqlClientImplPostgresMem[] = [];

afterEach(async () => {
  while (openClients.length > 0) {
    const client = openClients.pop();
    if (client) await client.disconnect();
  }
});

describe('loadPlaygroundTablePage', () => {
  test('loads auth_devices after postgres-mem PGMM round-trip', async () => {
    const source = SqlClientImplPostgresMem.open({
      seed: 1,
      now: () => new Date(TS),
    });
    openClients.push(source);
    await source.connect();
    await applyPostgresSchema(
      source,
      registerTables([
        defineTable({
          domain: 'auth',
          name: 'auth_devices',
          columns: {
            platform: 'text',
            first_seen_at: 'timestamp',
          },
        }),
      ]),
      source.dbScope,
      { skipAdvisoryLock: true }
    );
    await source.run(sql`
      INSERT INTO auth_devices (
        id, platform, first_seen_at, created_at, updated_at, deleted_at
      ) VALUES (
        ${'dev-1'}, ${'web'}, ${TS}, ${TS}, ${TS}, ${null}
      )
    `);

    const restored = SqlClientImplPostgresMem.open({
      seed: 1,
      now: () => new Date(TS),
    });
    openClients.push(restored);
    await restored.connect();
    restored.importDatabaseBytes(source.exportDatabaseBytes());

    const page = await loadPlaygroundTablePage(restored, 'auth_devices', {
      offset: 0,
      limit: 50,
      orderBy: null,
      orderDir: 'asc',
    });
    expect(page.totalCount).toBe(1);
    expect(page.rows).toHaveLength(1);
    expect(page.rows[0]?.['id']).toBe('dev-1');
    expect(page.rows[0]?.['platform']).toBe('web');
  });
});
