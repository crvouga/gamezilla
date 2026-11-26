import { expect, spyOn, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { replayWithSavepoints } from '@pkgs/sync-engine-client-ts/replay-savepoint';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import fc from 'fast-check';

test('replaying a batch keeps exactly the accepted effects and invokes each body once', async () => {
  await assertProperty(
    'queued writes preserve order and allocated ids across refusals',
    fc.asyncProperty(
      fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }),
      async (accepted) => {
        const db = SqlClientImplMockingbirdSqlite.open();
        try {
          await db.run(
            sql`CREATE TABLE events (id INTEGER PRIMARY KEY, previous_count INTEGER)`
          );
          let next = 0;
          const writes = accepted.map((keep) => async (tx: SqlTx) => {
            const id = next++;
            const [row] = await tx.query(
              sql<{ n: number }>`SELECT COUNT(*) AS n FROM events`
            );
            await tx.run(
              sql`INSERT INTO events (id, previous_count) VALUES (${id}, ${row?.n})`
            );
            if (!keep) throw new MutationError('REFUSED', 'refused');
          });
          await db.transaction((tx) => replayWithSavepoints(tx, writes));
          const ids = accepted.flatMap((keep, id) => (keep ? [id] : []));
          expect(
            await db.query(
              sql<{
                id: number;
                previous_count: number;
              }>`SELECT id, previous_count FROM events ORDER BY id`
            )
          ).toEqual(ids.map((id, previous_count) => ({ id, previous_count })));
          expect(next).toBe(accepted.length);
        } finally {
          await db.disconnect();
        }
      }
    )
  );
});

test('a late refusal preserves completed batches; a storage failure rolls back the whole merge', async () => {
  const db = SqlClientImplMockingbirdSqlite.open();
  try {
    await db.run(sql`CREATE TABLE events (id INTEGER PRIMARY KEY)`);
    const writes = Array.from({ length: 140 }, (_, id) => async (tx: SqlTx) => {
      await tx.run(sql`INSERT INTO events (id) VALUES (${id})`);
      if (id === 135) throw new MutationError('REFUSED', 'refused');
    });
    await expect(
      db.transaction((tx) =>
        replayWithSavepoints(tx, [
          ...writes,
          async () => {
            throw new Error('storage failed');
          },
        ])
      )
    ).rejects.toThrow('storage failed');
    expect(
      await db.query(sql<{ n: number }>`SELECT COUNT(*) AS n FROM events`)
    ).toEqual([{ n: 0 }]);
    await db.transaction((tx) => replayWithSavepoints(tx, writes));
    expect(
      await db.query(sql<{ id: number }>`SELECT id FROM events ORDER BY id`)
    ).toEqual(writes.flatMap((_, id) => (id === 135 ? [] : [{ id }])));
  } finally {
    await db.disconnect();
  }
});

test('100 accepted single-statement replays share a savepoint', async () => {
  const db = SqlClientImplMockingbirdSqlite.open();
  try {
    await db.run(sql`CREATE TABLE events (id INTEGER PRIMARY KEY)`);
    await db.transaction(async (tx) => {
      const statements = spyOn(tx, 'run');
      const writes = Array.from(
        { length: 100 },
        (_, id) => async (port: SqlTx) => {
          await port.run(sql`INSERT INTO events (id) VALUES (${id})`);
        }
      );
      await replayWithSavepoints(tx, writes);
      expect(statements.mock.calls.length).toBeLessThanOrEqual(
        writes.length + 2
      );
    });
    expect(
      await db.query(sql<{ n: number }>`SELECT COUNT(*) AS n FROM events`)
    ).toEqual([{ n: 100 }]);
  } finally {
    await db.disconnect();
  }
});
