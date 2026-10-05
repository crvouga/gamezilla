// @io-wall-ok — live health: the environment's Postgres.
/** `specs/runtime/serving-people.feature`. */

import { expect } from 'bun:test';
import { appPostgresDbScope } from '@libs/db-shared/scope';
import { appSchema } from '@libs/runtime-shared/app-schema';
import { readPostgresCatalog } from '@pkgs/db-schema-postgres-shared/catalog';
import { planServer } from '@pkgs/db-schema-root-shared/plan-server';
import { createPgPool } from '@pkgs/sql-client-postgres-server/connect';
import type { PostgresSqlClient } from '@pkgs/sql-client-root-shared/interface';
import { Then } from './define';
import { requireSecret } from './live-world';

Then('what people saved is ready for the app as it is now', async () => {
  const dbScope = appPostgresDbScope();
  const { pool, sqlClient } = createPgPool({
    connectionString: requireSecret('DATABASE_URL'),
    dbScope,
    max: 1,
  });
  try {
    const client = Object.assign(sqlClient, { dbScope }) as PostgresSqlClient;
    const declared = appSchema._declared;
    const catalog = await readPostgresCatalog(client, declared);
    const plan = planServer(declared, catalog, { operations: 'table' });
    const pending = plan.ok
      ? plan.operations.map((op) => JSON.stringify(op))
      : plan.drift.map((d) => `drift ${d.path}: ${d.message}`);
    expect(pending, 'pending DDL — run `bun db:migrate`').toEqual([]);
  } finally {
    await pool.end();
  }
});
