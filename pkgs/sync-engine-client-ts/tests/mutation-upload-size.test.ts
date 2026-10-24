import { describe, expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { ensureFrameworkSchema } from '@pkgs/sync-engine-client-ts/local-schema';
import {
  MutationUploadQueue,
  type MutationUploadResult,
  type MutationUploadRow,
} from '@pkgs/sync-engine-client-ts/mutation-upload-queue';
import { createSyncHttpClient } from '@pkgs/sync-engine-client-ts/sync-http-client';
import { SyncHttpPayloadTooLargeError } from '@pkgs/sync-engine-client-ts/sync-http-payload-too-large-error';
import { createTableChangeBus } from '@pkgs/sync-engine-client-ts/table-change-bus';
import { MAX_MUTATIONS_BODY_BYTES } from '@pkgs/sync-engine-shared-ts/v2';

const CLIENT = 'client-1';

async function queueWith(args: readonly string[]) {
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
async function drain(
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

const applied = (rows: readonly MutationUploadRow[]): MutationUploadResult => ({
  ok: true,
  serverTimeMs: 10_000,
  verdicts: rows.map((row) => ({ mutationId: row.id, status: 'applied' })),
  ackSeq: rows.length,
});

// regression: mutation-upload-backlog-holds-database-session
test('a reconnect backlog is uploaded in short ordered batches', async () => {
  const db = await queueWith([
    '{"n":1}',
    '{"n":2}',
    '{"n":3}',
    '{"n":4}',
    '{"n":5}',
    '{"n":6}',
    '{"n":7}',
    '{"n":8}',
  ]);
  const batches: string[][] = [];
  try {
    const result = await drain(db, async (rows) => {
      batches.push(rows.map((row) => row.id));
      return applied(rows);
    });
    expect(result).toEqual({ errors: [], refused: [] });
    expect(batches.flat()).toEqual([
      'm-1',
      'm-2',
      'm-3',
      'm-4',
      'm-5',
      'm-6',
      'm-7',
      'm-8',
    ]);
    expect(
      Math.max(...batches.map((batch) => batch.length))
    ).toBeLessThanOrEqual(4);
    expect(
      await db.query(
        sql<{
          id: string;
        }>`SELECT id FROM sync_engine_mutations WHERE deleted_at IS NULL`
      )
    ).toEqual([]);
  } finally {
    await db.disconnect();
  }
});

describe('mutation uploads over the byte cap', () => {
  // regression: mutation-upload-oversized-retried-forever
  test('a batch the server refuses as too large is split until every write is sent', async () => {
    const db = await queueWith(['{"n":1}', '{"n":2}', '{"n":3}']);
    const sent: string[][] = [];
    const result = await drain(db, async (rows) => {
      sent.push(rows.map((row) => row.id));
      if (rows.length > 1) throw new SyncHttpPayloadTooLargeError(1);
      return applied(rows);
    });
    expect(result).toEqual({ errors: [], refused: [] });
    expect(sent.filter((ids) => ids.length === 1).flat()).toEqual([
      'm-1',
      'm-2',
      'm-3',
    ]);
  });

  test('a single write over the cap is refused without holding back later writes', async () => {
    const huge = JSON.stringify({ text: 'x'.repeat(MAX_MUTATIONS_BODY_BYTES) });
    const db = await queueWith(['{"n":1}', huge, '{"n":3}']);
    const sent: string[] = [];
    const result = await drain(db, async (rows) => {
      sent.push(...rows.map((row) => row.id));
      return applied(rows);
    });
    expect(result.errors).toEqual([]);
    expect(result.refused).toEqual([
      { mutation_id: 'm-2', code: 'payload_too_large' },
    ]);
    expect(sent).toEqual(['m-1', 'm-3']);
  });

  test('a single write the server refuses as too large is refused locally', async () => {
    const db = await queueWith(['{"n":1}', '{"n":2}']);
    const result = await drain(db, async (rows) => {
      if (rows.some((row) => row.id === 'm-1'))
        throw new SyncHttpPayloadTooLargeError(16);
      return applied(rows);
    });
    expect(result.errors).toEqual([]);
    expect(result.refused).toEqual([
      { mutation_id: 'm-1', code: 'payload_too_large' },
    ]);
  });
});

test('a 413 upload answer is reported as too large, never as a retryable failure', async () => {
  const { clock, timers } = createHarnessClock({ startMs: 10_000 });
  const client = createSyncHttpClient({
    getBaseUrl: () => 'http://api.test',
    fetchFn: async () =>
      Response.json(
        { error: 'payload_too_large', maxBytes: MAX_MUTATIONS_BODY_BYTES },
        { status: 413 }
      ),
    auth: {
      getAccountId: () => null,
      getDeviceId: () => 'device-1',
      getSessionToken: () => null,
    },
    timers,
    now: clock.now,
  });
  const refusal: unknown = await client
    .postMutations([])
    .catch((error: unknown) => error);
  expect(refusal).toBeInstanceOf(SyncHttpPayloadTooLargeError);
  expect(refusal).toMatchObject({ maxBytes: MAX_MUTATIONS_BODY_BYTES });
});
