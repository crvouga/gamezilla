import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { ensureFrameworkSchema } from '@pkgs/sync-engine-client-ts/local-schema';
import {
  MutationUploadQueue,
  type MutationUploadResult,
  type MutationUploadRow,
} from '@pkgs/sync-engine-client-ts/mutation-upload-queue';
import { createTableChangeBus } from '@pkgs/sync-engine-client-ts/table-change-bus';

const CLIENT = 'client-1';

export async function queueWith(args: readonly string[]) {
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  await ensureFrameworkSchema(db);
  for (const [index, arg] of args.entries()) {
    const at = new Date(1_000 + index).toISOString();
    await db.run(sql`
      INSERT INTO sync_engine_mutations (
        id, name, args, client_id, seq, created_at, updated_at, deleted_at
      ) VALUES (
        ${`m-${index + 1}`}, ${'note'}, ${arg}, ${CLIENT}, ${index + 1},
        ${at}, ${at}, ${null}
      )
    `);
  }
  return db;
}

/** Runs the queue on virtual time until nothing is left to upload. */
export async function drain(
  db: Awaited<ReturnType<typeof queueWith>>,
  postBatch: (
    rows: readonly MutationUploadRow[]
  ) => Promise<MutationUploadResult>
) {
  const { clock, timers } = createHarnessClock({ startMs: 10_000 });
  const errors: unknown[] = [];
  const queue = new MutationUploadQueue({
    db,
    bus: createTableChangeBus(),
    clientId: () => CLIENT,
    postBatch,
    onError: (error) => errors.push(error),
    timers,
    now: clock.now,
  });
  queue.start();
  for (let step = 0; step < 200; step += 1) {
    // Let the queue reach its next wait before virtual time moves on.
    for (let turn = 0; turn < 50; turn += 1) await Promise.resolve();
    clock.advance(100);
    const left = await db.query(
      sql<{
        n: number;
      }>`SELECT COUNT(*) AS n FROM sync_engine_mutations WHERE deleted_at IS NULL`
    );
    if (Number(left[0]?.n) === 0) break;
  }
  await queue.stop();
  const refused = await db.query(
    sql<{ mutation_id: string; code: string }>`
      SELECT mutation_id, code FROM sync_engine_write_rejections ORDER BY mutation_id
    `
  );
  return { errors, refused };
}

export const applied = (
  rows: readonly MutationUploadRow[]
): MutationUploadResult => ({
  ok: true,
  serverTimeMs: 10_000,
  verdicts: rows.map((row) => ({ mutationId: row.id, status: 'applied' })),
  ackSeq: rows.length,
});
