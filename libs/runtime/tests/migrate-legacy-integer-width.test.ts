/**
 * Migrate must upgrade a database whose `integer` columns predate the
 * physical-type drift check (`int4` rather than `bigint`).
 *
 * Every deploy from PR #19 to #26 failed `@libs/db#migrate` on this: the dev
 * database's chess columns were `int4`, reconcile compares physical types and
 * never ALTERs one, so it refused. A migration against a fresh database always
 * passed, which is why nothing in `bun check` saw it.
 */
import { describe, expect, test } from 'bun:test';
import { appPostgresDbScope } from '@libs/db/public/scope';
import { appSchema } from '@libs/runtime/root/app-schema';
import { migrateSimPostgres } from '@libs/runtime/root/sim/migrate-sim-postgres';
import { unsafe } from '@pkgs/sql';
import { createPostgresMemSqlClient } from '@pkgs/sql-client-postgres/impl-postgres-mem';

function declaredIntegerColumns(): { table: string; column: string }[] {
  const snapshot = appSchema.snapshot();
  const out: { table: string; column: string }[] = [];
  for (const [table, columns] of Object.entries(snapshot.tables)) {
    for (const [column, type] of Object.entries(columns)) {
      if (
        type === 'integer' &&
        snapshot.physicalOverrides[table]?.[column]?.postgres === undefined
      ) {
        out.push({ table, column });
      }
    }
  }
  for (const [table, columns] of Object.entries(snapshot.retiredColumns)) {
    for (const [column, retired] of Object.entries(columns)) {
      if (retired.type === 'integer') out.push({ table, column });
    }
  }
  return out;
}

async function udtNames(
  sqlClient: ReturnType<typeof createPostgresMemSqlClient>['sqlClient']
): Promise<Map<string, string>> {
  const rows = await sqlClient.query<{
    table_name: string;
    column_name: string;
    udt_name: string;
  }>(
    unsafe(`
      SELECT table_name, column_name, udt_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
    `)
  );
  return new Map(
    rows.map((r) => [`${r.table_name}.${r.column_name}`, r.udt_name])
  );
}

describe('migrate: legacy int4 integer columns', () => {
  test('widens every declared integer column narrowed to int4', async () => {
    const { sqlClient, pool } = createPostgresMemSqlClient({
      seed: 1,
      dbScope: appPostgresDbScope(),
    });
    const now = () => 0;
    await migrateSimPostgres({ sqlClient, pool, now });

    const columns = declaredIntegerColumns();
    expect(columns.length).toBeGreaterThan(0);
    for (const { table, column } of columns) {
      await sqlClient.run(
        unsafe(`ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE integer`)
      );
    }
    const narrowed = await udtNames(sqlClient);
    for (const { table, column } of columns) {
      expect(narrowed.get(`${table}.${column}`)).toBe('int4');
    }

    await migrateSimPostgres({ sqlClient, pool, now });

    const widened = await udtNames(sqlClient);
    for (const { table, column } of columns) {
      expect(`${table}.${column}=${widened.get(`${table}.${column}`)}`).toBe(
        `${table}.${column}=int8`
      );
    }
    await sqlClient.disconnect();
  });
});
