import { expect, test } from 'bun:test';
import { serve } from '@crvouga/mockingbird-service-postgres/wire';
import { openMockingbirdDatabase } from '@pkgs/postgres-mockingbird-server-ts/start';
import { SQL } from 'bun';

// regression: mockingbird-postgres-checkpoint-retention
test('transactions on a long-running server do not pile up database copies', async () => {
  const database = openMockingbirdDatabase(null);
  const server = await serve({
    database,
    url: 'postgresql://postgres:postgres@127.0.0.1:0/local',
  });
  const sql = new SQL({ url: server.connectionString, max: 1 });
  try {
    await sql.unsafe('CREATE TABLE rows (id text PRIMARY KEY, n int4)');
    for (let i = 0; i < 50; i++) {
      await sql.begin(async (tx) => {
        await tx.unsafe('INSERT INTO rows VALUES ($1, 0)', [`row-${i}`]);
        await tx.unsafe('UPDATE rows SET n = n + 1 WHERE id = $1', [
          `row-${i}`,
        ]);
      });
    }
    expect(
      (
        await sql.unsafe<{ n: number }[]>(
          'SELECT count(*)::int4 AS n FROM rows'
        )
      )[0]
    ).toEqual({ n: 50 });
    // Each statement inside a transaction branches the database; with the
    // engine's default every one of those copies stayed (100 here).
    expect(database.history.checkpoints().length).toBeLessThanOrEqual(3);
  } finally {
    await sql.close();
    await server.close();
    database.close();
  }
});
