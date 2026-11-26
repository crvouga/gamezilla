// @io-wall-ok — live health: the environment's Postgres.
/** `specs/runtime/serving-people.feature`. */

import { expect } from 'bun:test';
import { appPostgresDbScope } from '@libs/db-shared-ts/scope';
import { appSchema } from '@libs/runtime-shared-ts/app-schema';
import { wallTimers } from '@pkgs/clock-shared-ts/wall';
import { readPostgresCatalog } from '@pkgs/db-schema-postgres-shared-ts/catalog';
import { planServer } from '@pkgs/db-schema-root-shared-ts/plan-server';
import { openPgClient } from '@pkgs/sql-client-postgres-server-ts/connect';
import { connectPostgresProbe } from '@pkgs/sql-client-postgres-server-ts/ping';
import { Then } from './define';
import { requireSecret } from './live-world';

Then('what people saved is ready for the app as it is now', async () => {
  const dbScope = appPostgresDbScope();
  const connectionString = requireSecret('DATABASE_URL');
  const { sqlClient } = await connectPostgresProbe(
    () =>
      openPgClient({
        connectionString,
        dbScope,
        clientOptions: { connectionTimeoutMillis: 5000 },
      }),
    wallTimers
  );
  try {
    const declared = appSchema._declared;
    const catalog = await readPostgresCatalog(sqlClient, declared);
    const plan = planServer(declared, catalog, { operations: 'table' });
    const pending = plan.ok
      ? plan.operations.map((op) => JSON.stringify(op))
      : plan.drift.map((d) => `drift ${d.path}: ${d.message}`);
    expect(pending, 'pending DDL — run `bun db:migrate`').toEqual([]);
  } finally {
    await sqlClient.disconnect();
  }
});
