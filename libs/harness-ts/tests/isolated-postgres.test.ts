import { expect, test } from 'bun:test';
import { isolatedPostgres } from '@libs/harness-ts/isolated-postgres';
import { composeHarnessSlices } from '@libs/harness-ts/slices';
import sql from '@pkgs/sql-root-shared-ts/sql';

test('browser scenarios may reuse a diagnostic ID without sharing database rows', async () => {
  // regression: browser-scenario-database-isolation
  const composition = composeHarnessSlices('wire-isolation', []);
  const first = await isolatedPostgres(composition);
  const second = await isolatedPostgres(composition);
  const row = sql`INSERT INTO sync_engine_observability_events
    (id, event_name, mutation_id, created_at, updated_at)
    VALUES (${'77777777-7777-4777-8777-777777777777'}, ${'mutation.persisted'},
    ${'11111111-1111-4111-8111-111111111111'},
    ${'2024-06-01T00:00:00.000Z'}, ${'2024-06-01T00:00:00.000Z'})`;
  try {
    await first.sqlClient.run(row);
    expect(
      await second.sqlClient.query(
        sql<{ id: string }>`SELECT id FROM sync_engine_observability_events`
      )
    ).toEqual([]);
    await second.sqlClient.run(row);
    expect(
      await first.sqlClient.query(
        sql<{ id: string }>`SELECT id FROM sync_engine_observability_events`
      )
    ).toHaveLength(1);
    expect(first.databaseUrl).not.toBe(second.databaseUrl);
  } finally {
    await first.stop();
    await second.stop();
  }
});
