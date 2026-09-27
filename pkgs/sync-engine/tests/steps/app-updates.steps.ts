/**
 * App updates and connections: people using the app, slow connections, the
 * app moving to another version (a local schema variant, kept on disk), and
 * how quickly a note arrives.
 */

import { expect } from 'bun:test';
import {
  connection,
  lastError,
  liveNote,
  netSet,
  restartWithSchema,
} from '@pkgs/sync-engine/sim';
import { SETTLE_MS } from './note-writes';
import {
  app,
  type Device,
  ensureDevice,
  Given,
  type SyncWorld,
  Then,
  When,
} from './world';

/** Slow but lossless: 60 ms ± 40 ms each way on every channel. */
const SLOW = {
  latencyMeanMs: 60,
  latencyJitterMs: 40,
  dropProbability: 0,
  packetReplayProbability: 0,
  reorderWindow: 0,
  partitionProbability: 0,
  healProbability: 0,
} as const;

/** "Within a quarter of a second", checked every few milliseconds of the run's clock. */
const QUARTER_SECOND_MS = 250;
const QUICK_STEP_MS = 5;

Given('{actor} and {actor} use the app', async (w, a: string, b: string) => {
  await ensureDevice(w, app(a));
  await ensureDevice(w, app(b));
});

Given(
  '{actor} and {actor} have slow connections',
  async (w, a: string, b: string) => {
    for (const actor of [a, b]) {
      const id = await ensureDevice(w, app(actor));
      await w.s.apply(netSet, id, 'live', SLOW);
      await w.s.apply(netSet, id, 'sync', SLOW);
    }
  }
);

Then(
  '{actor} sees the note {string} within a quarter of a second',
  async (w, actor: string, title: string) => {
    const row = await w.s.until((s) => liveNote(s, actor, title), {
      maxMs: QUARTER_SECOND_MS,
      stepMs: QUICK_STEP_MS,
      pred: (r) => r !== null && r.deletedAt === null,
    });
    expect(row).toMatchObject({ title, deletedAt: null });
  }
);

async function moveTo(
  w: SyncWorld,
  device: Device,
  variant: string
): Promise<void> {
  const id = await ensureDevice(w, device);
  await w.s.apply(restartWithSchema, id, variant);
}

When(
  '{device} updates to a version that fetches every note again',
  (w, device: Device) => moveTo(w, device, 'epochBump')
);

Given(
  '{device} has updated to a version that gives notes a colour',
  (w, device: Device) => moveTo(w, device, 'extraColumn')
);

Given(
  '{device} has updated to a version that tags notes',
  (w, device: Device) => moveTo(w, device, 'extraTable')
);

When('{device} goes back to the earlier version', (w, device: Device) =>
  moveTo(w, device, 'baseline')
);

Then('{device} is still connected', async (w, device: Device) => {
  const id = await ensureDevice(w, device);
  const state = await w.s.until((s) => connection(s, id), {
    maxMs: SETTLE_MS,
    pred: (c) => c === 'connected',
  });
  expect(state).toBe('connected');
  expect(await w.s.read(lastError, id)).toBeNull();
});
