// @io-wall-ok — live health: the environment's Postgres.
/** `specs/health/postgres.feature`. */

import { expect } from 'bun:test';
import { appPostgresDbScope } from '@libs/db/public/scope';
import { appSchema } from '@libs/runtime/root/app-schema';
import { wallTimers } from '@pkgs/clock';
import { planServer } from '@pkgs/db-schema/core/plan-server';
import { readPostgresCatalog } from '@pkgs/db-schema-postgres/catalog';
import type { PostgresSqlClient } from '@pkgs/sql-client/interface';
import { createPgPool } from '@pkgs/sql-client-postgres/connect';
import { pingPostgres } from '@pkgs/sql-client-postgres/ping';
import { Then } from './define';
import { requireSecret } from './live-world';

Then('the database answers a read-only query', async () => {
  await pingPostgres(requireSecret('DATABASE_URL'), wallTimers);
});

Then('the database has every table and column the app declares', async () => {
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
