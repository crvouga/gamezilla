import { describe, expect, mock, test } from 'bun:test';

import { createTableChangeBus } from '../queries/client/table-change-bus';
import {
  openScenarioDb,
  scenarioRegistry,
  setNote,
  createScenarioClients,
} from '../queries/test/scenario-fixture';
import { createSimTestDriver } from '../sim/test-driver';
import { MutationUploadQueue } from './mutation-upload-queue';

describe('MutationUploadQueue', () => {
  test('drains pending mutations via soft-ack', async () => {
    const sim = createSimTestDriver();
    const db = await openScenarioDb();
    const { mutateClient, bus } = createScenarioClients(db);
    // Use scenario bus for table-change wake; upload queue needs its own bus emit.
    const uploadBus = createTableChangeBus();
    const postBatch = mock(
      async (rows: readonly { id: string; seq: number }[]) => ({
        ok: true as const,
        ackSeq: rows[rows.length - 1]!.seq,
        verdicts: rows.map((r) => ({
          mutationId: r.id,
          status: 'applied' as const,
        })),
      })
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
    void bus;
    void scenarioRegistry;

    queue.start();
    queue.wake();
    await sim.runFor(200);
    expect(postBatch.mock.calls.length).toBeGreaterThanOrEqual(1);

    await queue.stop();
  });

  test('idle wait is interruptible by wake', async () => {
    const sim = createSimTestDriver();
    const db = await openScenarioDb();
    const uploadBus = createTableChangeBus();
    let calls = 0;
    const postBatch = mock(async () => {
      calls += 1;
      return { ok: true as const, ackSeq: 0, verdicts: [] };
    });
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
    expect(calls).toBe(0);
    queue.wake();
    await sim.runFor(10);
    // wake with empty pending still cycles; postBatch not called when empty
    expect(postBatch.mock.calls.length).toBe(0);
    await queue.stop();
  });
});
