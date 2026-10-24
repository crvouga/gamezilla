import { expect, test } from 'bun:test';
import sql, { raw } from '@pkgs/sql-root-shared-ts/sql';
import { BUN_SQLITE_FACTORY, MOCKINGBIRD_SQLITE_FACTORY } from './registry';

for (const factory of [BUN_SQLITE_FACTORY, MOCKINGBIRD_SQLITE_FACTORY]) {
  // regression: sqlite-read-sees-intermediate-transaction
  test(`${factory.name}: a concurrent read sees the committed position rather than an intermediate rebase`, async () => {
    const backend = await factory.open();
    const entered = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    let writer: Promise<void> | undefined;
    try {
      await backend.client.run(
        raw(
          'CREATE TABLE isolation_example (id TEXT PRIMARY KEY, n INTEGER NOT NULL)'
        )
      );
      await backend.client.run(
        sql`INSERT INTO isolation_example (id, n) VALUES (${'position'}, ${31})`
      );
      writer = backend.client.transaction(async (tx) => {
        await tx.run(
          sql`UPDATE isolation_example SET n = ${4} WHERE id = ${'position'}`
        );
        entered.resolve();
        await release.promise;
        await tx.run(
          sql`UPDATE isolation_example SET n = ${31} WHERE id = ${'position'}`
        );
      });
      await entered.promise;
      const read = backend.client.query(
        sql<{
          n: number;
        }>`SELECT n FROM isolation_example WHERE id = ${'position'}`
      );
      release.resolve();
      await writer;
      expect(await read).toEqual([{ n: 31 }]);
    } finally {
      release.resolve();
      await writer;
      await backend.close();
    }
  });
}
