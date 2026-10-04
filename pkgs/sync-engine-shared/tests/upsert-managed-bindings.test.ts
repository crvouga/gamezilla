import { expect, test } from 'bun:test';
import sql from '@pkgs/sql-shared/sql';
import { wrapMutationDb } from '@pkgs/sync-engine-shared/wrap-mutation-db';

// regression: upsert-managed-bindings-reordered
test('managed insert values precede the upsert clause parameters', async () => {
  let captured: readonly unknown[] = [];
  const tx = {
    query: async (query: { values: readonly unknown[] }) => {
      captured = query.values;
      return [];
    },
    run: async () => ({ changes: 0, lastInsertRowid: 0 }),
  };
  const now = '2026-10-01T00:00:00.000Z';
  const wrapped = wrapMutationDb(tx, {
    actorId: 'alice',
    deviceId: 'phone',
    accountId: 'alice',
    isAnon: false,
    now: () => new Date(now),
    createId: () => 'id',
  });
  await wrapped.tx.run(
    sql`INSERT INTO notes (id, title) VALUES (${'note'}, ${'Preparing'}) ON CONFLICT (id) DO UPDATE SET title = ${'Ready'}`
  );
  expect(captured).toEqual(['note', 'Preparing', now, now, 'Ready']);
});
