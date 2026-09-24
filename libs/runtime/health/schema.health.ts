// @io-wall-ok — live health probe (process root against the env's Postgres).
import { describe, expect, test } from 'bun:test';
import { appPostgresDbScope } from '@libs/db/public/scope';
import { appSchema } from '@libs/runtime/root/app-schema';
import { planServer } from '@pkgs/db-schema/core/plan-server';
import { readPostgresCatalog } from '@pkgs/db-schema-postgres/catalog';
import type { PostgresSqlClient } from '@pkgs/sql-client/interface';
import { createPgPool } from '@pkgs/sql-client-postgres/connect';

describe('app schema', () => {
  test('live Postgres has every declared table and column (migrate ran)', async () => {
    const url = process.env['DATABASE_URL']?.trim() ?? '';
    expect(url, 'DATABASE_URL missing from secrets env').not.toBe('');
    const dbScope = appPostgresDbScope();
    const { pool, sqlClient } = createPgPool({
      connectionString: url,
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
});
