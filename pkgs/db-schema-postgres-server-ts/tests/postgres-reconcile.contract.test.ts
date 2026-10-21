// Legacy NOT NULL, int4, and managed defaults reconcile over the Postgres wire.
// Mockingbird gaps are tracked in libs/tools-harness-ts/MOCKINGBIRD_MIGRATION.md.

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readPostgresCatalog } from '@pkgs/db-schema-postgres-shared-ts/catalog';
import { postgres } from '@pkgs/db-schema-postgres-shared-ts/driver';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres-shared-ts/reconcile-postgres-schema';
import { defineSchema } from '@pkgs/db-schema-root-shared-ts/define-schema';
import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { databaseUrlFor } from '@pkgs/postgres-local-shared-ts/ports';
import { freePostgresPort } from '@pkgs/postgres-mockingbird-server-ts/free-port';
import { startMockingbirdPostgres } from '@pkgs/postgres-mockingbird-server-ts/start';
import {
  createPgPool,
  openPgClient,
} from '@pkgs/sql-client-postgres-server-ts/connect';
import type { PostgresSqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { createPostgresDbScope } from '@pkgs/sql-client-root-shared-ts/postgres-db-scope';
import { raw } from '@pkgs/sql-root-shared-ts/sql';

describe('postgres legacy NOT NULL/int4 reconcile (contract)', () => {
  let sqlClient: PostgresSqlClient;
  let stop: () => Promise<void>;
  const testSchema = `contract_${randomUUID().replace(/-/g, '_')}`;
  const dataDir = join(tmpdir(), `pg-reconcile-contract-${randomUUID()}`);
  beforeAll(async () => {
    const pg = await startMockingbirdPostgres({
      dataDir,
      port: await freePostgresPort(),
    });
    const url = databaseUrlFor(pg.port);
    const dbScope = createPostgresDbScope(testSchema);
    const opened = await openPgClient({
      connectionString: url,
      dbScope,
      ensureSchema: true,
    });
    const pooled = createPgPool({
      connectionString: url,
      dbScope,
      max: 1,
    });
    sqlClient = pooled.sqlClient;
    await opened.sqlClient.disconnect();
    stop = pg.stop;
  }, 30_000);

  afterAll(async () => {
    await sqlClient?.disconnect();
    await stop?.();
  });

  test('legacy NOT NULL, int4, and now() default reconcile in place', async () => {
    await reconcilePostgresSchema(
      sqlClient,
      registerTables([
        defineTable({
          domain: 'legacy_puzzle_shape',
          name: 'legacy_puzzle_shape',
          columns: { rating: 'integer', body: 'text' },
        }),
      ]),
      sqlClient.dbScope
    );

    await sqlClient.run(
      raw(`ALTER TABLE legacy_puzzle_shape ALTER COLUMN body SET NOT NULL`)
    );
    await sqlClient.run(
      raw(`ALTER TABLE legacy_puzzle_shape ALTER COLUMN rating SET NOT NULL`)
    );
    await sqlClient.run(
      raw(`ALTER TABLE legacy_puzzle_shape ALTER COLUMN rating TYPE integer`)
    );
    await sqlClient.run(
      raw(
        `ALTER TABLE legacy_puzzle_shape ALTER COLUMN created_at SET DEFAULT now()`
      )
    );

    const schema = defineSchema({
      tables: {
        legacy_puzzle_shape: { rating: 'integer', body: 'text' },
      },
    });
    await postgres(schema, sqlClient).reconcile();

    const catalog = await readPostgresCatalog(sqlClient, schema._declared);
    const table = catalog.tables.get('legacy_puzzle_shape');
    const rating = table?.columns.find((c) => c.name === 'rating');
    const body = table?.columns.find((c) => c.name === 'body');
    const createdAt = table?.columns.find((c) => c.name === 'created_at');
    expect(rating?.type).toBe('integer');
    expect(rating?.physical).toBe('int8');
    expect(rating?.nullable).toBe(true);
    expect(body?.nullable).toBe(true);
    expect(createdAt?.columnDefault).toBeNull();
  });
});
