import { describe, expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createSyncHttpClient } from '@pkgs/sync-engine-client-ts/sync-http-client';
import { SyncHttpPayloadTooLargeError } from '@pkgs/sync-engine-client-ts/sync-http-payload-too-large-error';
import { MAX_MUTATIONS_BODY_BYTES } from '@pkgs/sync-engine-shared-ts/v2';
import { applied, drain, queueWith } from './mutation-upload-fixture';

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
