import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { ensureFrameworkSchema } from '@pkgs/sync-engine-client-ts/local-schema';
import { MutationUploadQueue } from '@pkgs/sync-engine-client-ts/mutation-upload-queue';
import { createTableChangeBus } from '@pkgs/sync-engine-client-ts/table-change-bus';

// regression: refused-write-refresh-blocks-fresh-mutations
test('a refused write refresh does not hold the next write behind a read', async () => {
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  await ensureFrameworkSchema(db);
  const { clock, timers } = createHarnessClock({ startMs: 1_000 });
  const refresh = Promise.withResolvers<void>();
  const started = Promise.withResolvers<void>();
  const sent: string[] = [];
  const errors: unknown[] = [];
  const queue = new MutationUploadQueue({
    db,
    bus: createTableChangeBus(),
    clientId: () => 'alice-phone',
    timers,
    now: clock.now,
    onError: (error) => errors.push(error),
    onRejected: () => {
      started.resolve();
      return refresh.promise;
    },
    postBatch: async (rows) => {
      sent.push(...rows.map((row) => row.id));
      return {
        ok: true,
        serverTimeMs: clock.now(),
        ackSeq: rows.at(-1)?.seq ?? 0,
        verdicts: rows.map((row) =>
          row.id === 'first-choice'
            ? {
                mutationId: row.id,
                status: 'rejected' as const,
                code: 'REFUSED',
                message: 'The first choice was refused.',
              }
            : { mutationId: row.id, status: 'applied' as const }
        ),
      };
    },
  });
  const insert = (id: string, seq: number) =>
    db.run(sql`
    INSERT INTO sync_engine_mutations (id, name, args, client_id, seq, created_at, updated_at, deleted_at)
    VALUES (${id}, ${'note'}, ${'{}'}, ${'alice-phone'}, ${seq}, ${new Date(1_000).toISOString()}, ${new Date(1_000).toISOString()}, ${null})
  `);
  await insert('first-choice', 1);
  queue.start();
  try {
    await started.promise;
    await insert('fresh-choice', 2);
    queue.wake();
    for (let step = 0; step < 20 && !sent.includes('fresh-choice'); step++) {
      for (let turn = 0; turn < 50; turn++) await Promise.resolve();
      clock.advance(50);
    }
    expect(errors).toEqual([]);
    expect(sent).toEqual(['first-choice', 'fresh-choice']);
  } finally {
    refresh.resolve();
    await queue.stop();
    await db.disconnect();
  }
});
