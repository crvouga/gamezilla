import { describe, expect, mock, test } from 'bun:test';
import { sql } from '@pkgs/sql';

import { createTableChangeBus } from '../queries/client/table-change-bus';
import {
  createScenarioClients,
  openScenarioDb,
  setNote,
} from '../queries/test/scenario-fixture';
import { createSimTestDriver } from '../sim/test-driver';
import {
  MutationUploadQueue,
  type MutationUploadResult,
  type MutationUploadRow,
} from './mutation-upload-queue';

function appliedResult(
  rows: readonly { id: string; seq: number }[]
): MutationUploadResult {
  return {
    ok: true,
    ackSeq: rows[rows.length - 1]?.seq ?? 0,
    verdicts: rows.map((r) => ({
      mutationId: r.id,
      status: 'applied' as const,
    })),
  };
}

describe('MutationUploadQueue', () => {
  test('ack deletes the pending mutation immediately', async () => {
    const sim = createSimTestDriver();
    const db = await openScenarioDb();
    const { mutateClient } = createScenarioClients(db);
    const uploadBus = createTableChangeBus();
    const postBatch = mock(async (rows: readonly MutationUploadRow[]) =>
      appliedResult(rows)
    );

    const queue = new MutationUploadQueue({
      db,
      bus: uploadBus,
      clientId: () => 'device-1',
      postBatch,
      onError: (e) => {
        throw e;
      },
      timers: sim.timers,
      now: sim.now,
    });

    const result = await mutateClient.mutate(setNote, {
      id: 'n1',
      body: 'hello',
    });
    expect(result.ok).toBe(true);

    queue.start();
    queue.wake();
    await sim.runFor(200);
    expect(postBatch.mock.calls.length).toBeGreaterThanOrEqual(1);
    const pending = await db.query(sql<{ id: string }>`
      SELECT id FROM _mutations
    `);
    expect(pending).toEqual([]);

    await queue.stop();
  });

  test('idle wait is interruptible by wake', async () => {
    const sim = createSimTestDriver();
    const db = await openScenarioDb();
    const uploadBus = createTableChangeBus();
    const postBatch = mock(async () => appliedResult([]));
    const queue = new MutationUploadQueue({
      db,
      bus: uploadBus,
      clientId: () => 'device-1',
      postBatch,
      onError: () => undefined,
      timers: sim.timers,
      now: sim.now,
    });
    queue.start();
    await sim.runFor(50);
    expect(postBatch.mock.calls.length).toBe(0);
    queue.wake();
    await sim.runFor(10);
    expect(postBatch.mock.calls.length).toBe(0);
    await queue.stop();
  });

  test('burst of mutates coalesces into one upload batch', async () => {
    const sim = createSimTestDriver();
    const db = await openScenarioDb();
    const { mutateClient } = createScenarioClients(db);
    const uploadBus = createTableChangeBus();
    const batches: number[] = [];
    const postBatch = mock(async (rows: readonly MutationUploadRow[]) => {
      batches.push(rows.length);
      return appliedResult(rows);
    });

    const queue = new MutationUploadQueue({
      db,
      bus: uploadBus,
      clientId: () => 'device-1',
      postBatch,
      onError: (e) => {
        throw e;
      },
      timers: sim.timers,
      now: sim.now,
    });

    for (let i = 0; i < 5; i++) {
      const result = await mutateClient.mutate(setNote, {
        id: `n${i}`,
        body: `b${i}`,
      });
      expect(result.ok).toBe(true);
    }

    queue.start();
    queue.wake();
    await sim.runFor(50);

    expect(batches).toEqual([5]);
    const pending = await db.query(sql<{ id: string }>`
      SELECT id FROM _mutations
    `);
    expect(pending).toEqual([]);
    await queue.stop();
  });

  test('mutate during inflight upload drains on next cycle via sticky wake', async () => {
    const sim = createSimTestDriver();
    const db = await openScenarioDb();
    const { mutateClient } = createScenarioClients(db);
    const uploadBus = createTableChangeBus();

    let releaseFirst: (() => void) | undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const batches: string[][] = [];
    const postBatch = mock(async (rows: readonly MutationUploadRow[]) => {
      batches.push(rows.map((r) => r.id));
      if (batches.length === 1) await firstGate;
      return appliedResult(rows);
    });

    const queue = new MutationUploadQueue({
      db,
      bus: uploadBus,
      clientId: () => 'device-1',
      postBatch,
      onError: (e) => {
        throw e;
      },
      timers: sim.timers,
      now: sim.now,
    });

    const first = await mutateClient.mutate(setNote, {
      id: 'n1',
      body: 'one',
    });
    expect(first.ok).toBe(true);

    queue.start();
    queue.wake();
    await sim.runFor(5);
    expect(batches.length).toBe(1);

    // Queued while first POST is in flight — wake must stick.
    const second = await mutateClient.mutate(setNote, {
      id: 'n2',
      body: 'two',
    });
    expect(second.ok).toBe(true);
    queue.wake();

    releaseFirst?.();
    await sim.runFor(50);

    expect(batches.length).toBe(2);
    expect(batches[1]?.length).toBe(1);
    const pending = await db.query(sql<{ id: string }>`
      SELECT id FROM _mutations
    `);
    expect(pending).toEqual([]);
    await queue.stop();
  });

  test('failed upload backs off without busy loop; wake interrupts error wait', async () => {
    const sim = createSimTestDriver();
    const db = await openScenarioDb();
    const { mutateClient } = createScenarioClients(db);
    const uploadBus = createTableChangeBus();
    let attempts = 0;
    const errors: unknown[] = [];
    const postBatch = mock(async (rows: readonly MutationUploadRow[]) => {
      attempts += 1;
      if (attempts === 1) throw new Error('offline');
      return appliedResult(rows);
    });

    const queue = new MutationUploadQueue({
      db,
      bus: uploadBus,
      clientId: () => 'device-1',
      postBatch,
      onError: (e) => {
        errors.push(e);
      },
      timers: sim.timers,
      now: sim.now,
    });

    const result = await mutateClient.mutate(setNote, {
      id: 'n1',
      body: 'hello',
    });
    expect(result.ok).toBe(true);

    queue.start();
    queue.wake();
    await sim.runFor(20);
    expect(attempts).toBe(1);
    expect(errors.length).toBe(1);

    // Still in error backoff — must not busy-loop.
    await sim.runFor(500);
    expect(attempts).toBe(1);

    queue.wake();
    await sim.runFor(20);
    expect(attempts).toBe(2);

    const pending = await db.query(sql<{ id: string }>`
      SELECT id FROM _mutations
    `);
    expect(pending).toEqual([]);
    await queue.stop();
  });
});
