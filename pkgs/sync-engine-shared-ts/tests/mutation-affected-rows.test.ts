import { expect, test } from 'bun:test';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MutationDb } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { wrapMutationDb } from '@pkgs/sync-engine-shared-ts/wrap-mutation-db';

// regression: mutation-write-zero-affected-rows
test('mutation writes preserve affected row counts for conditional updates', async () => {
  const returned = [{ id: 'river', edition: 1 }];
  const tx: MutationDb = {
    query: async <T>(_query: Sql<T>) => returned as unknown as T[],
    run: async () => ({ changes: 0, lastInsertRowid: 0 }),
  };
  const wrapped = wrapMutationDb(tx, {
    actorId: 'alice',
    deviceId: 'phone',
    accountId: 'alice',
    isAnon: false,
    now: () => new Date('2026-10-23T00:00:00.000Z'),
    createId: () => 'id',
  });
  const statement = sql`UPDATE puzzles SET edition = ${1} WHERE id = ${'river'} AND edition = ${0}`;
  expect((await wrapped.tx.run(statement)).changes).toBe(1);
  expect(wrapped.getCapture().images['puzzles']).toHaveLength(1);
  returned.length = 0;
  expect((await wrapped.tx.run(statement)).changes).toBe(0);
});
