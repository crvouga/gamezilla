// goal:the-bar:5 — legacy NOT NULL/int4 columns reconcile correctly
// against real Postgres (postgres-mem rejects ALTER COLUMN SET NOT NULL).

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defineTable, registerTables } from '@pkgs/db-schema';
import { defineSchema } from '@pkgs/db-schema/core/define-schema';
import { databaseUrlFor } from '@pkgs/postgres-embedded/ports';
import { startEmbeddedPostgres } from '@pkgs/postgres-embedded/start';
import { raw } from '@pkgs/sql';
import type { PostgresSqlClient } from '@pkgs/sql-client/interface';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { createPgPool, openPgClient } from '@pkgs/sql-client-postgres/connect';
import { readPostgresCatalog } from '../src/catalog';
import { postgres } from '../src/driver';
import { applyPostgresSchema } from '../src/index';

describe('postgres legacy NOT NULL/int4 reconcile (contract)', () => {
  let sqlClient: PostgresSqlClient;
  let stop: () => Promise<void>;
  const testSchema = `contract_${randomUUID().replace(/-/g, '_')}`;
  const dataDir = join(tmpdir(), `pg-reconcile-contract-${randomUUID()}`);
  beforeAll(async () => {
    const pg = await startEmbeddedPostgres({ dataDir, port: 15433 });
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

  test('legacy NOT NULL and int4 columns reconcile after nullability fix', async () => {
    // Create the initial schema with the postgres driver.
    await applyPostgresSchema(
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

    // Simulate legacy DDL that postgres-mem cannot run.
    await sqlClient.run(
      raw(`ALTER TABLE legacy_puzzle_shape ALTER COLUMN rating SET NOT NULL`)
    );
    await sqlClient.run(
      raw(`ALTER TABLE legacy_puzzle_shape ALTER COLUMN body SET NOT NULL`)
    );
    await sqlClient.run(
      raw(`ALTER TABLE legacy_puzzle_shape ALTER COLUMN rating DROP NOT NULL`)
    );
    await sqlClient.run(
      raw(`ALTER TABLE legacy_puzzle_shape ALTER COLUMN body DROP NOT NULL`)
    );

    // Reconcile — should be a no-op.
    const schema = defineSchema({
      tables: {
        legacy_puzzle_shape: { rating: 'integer', body: 'text' },
      },
    });
    await postgres(schema, sqlClient).reconcile();

    const catalog = await readPostgresCatalog(sqlClient, schema._declared);
    const rating = catalog.tables
      .get('legacy_puzzle_shape')
      ?.columns.find((c) => c.name === 'rating');
    const body = catalog.tables
      .get('legacy_puzzle_shape')
      ?.columns.find((c) => c.name === 'body');
    expect(rating?.type).toBe('integer');
    expect(rating?.nullable).toBe(true);
    expect(body?.nullable).toBe(true);
  });
});
