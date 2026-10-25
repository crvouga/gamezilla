import { expect, test } from 'bun:test';
import { LIGHT_CYCLES_TIMING } from '@libs/light-cycles-harness-ts/light-cycles-quad';
import {
  LIGHT_CYCLES_PROFILE_WORKLOAD,
  lightCyclesRoomProfile,
  primeLightCyclesProfile,
  readLightCyclesRoomProfile,
  sampleLightCyclesRoom,
} from '@libs/light-cycles-harness-ts/light-cycles-room-profile';

const W = LIGHT_CYCLES_PROFILE_WORKLOAD;
const TICK_MS = 1000 / LIGHT_CYCLES_TIMING.tickRate;

async function profile(spectators: number) {
  await using run = await lightCyclesRoomProfile.run({
    seed: 7331,
    args: { spectators },
  });
  await run.apply(primeLightCyclesProfile);
  await run.apply(sampleLightCyclesRoom, 3000);
  const sample = await run.read(readLightCyclesRoomProfile);
  if (sample === null) throw new Error('No room sample');
  return sample;
}

test('the room profile measures four riders and spectators over one fixed virtual window', async () => {
  const riders = await profile(0);
  const watched = await profile(2);
  for (const [sample, peers] of [
    [riders, 4],
    [watched, 6],
  ] as const) {
    expect(sample.peers).toBe(peers);
    expect(sample.virtualMs).toBe(3000);
    expect(sample.phase).not.toBe('completed');
    // The arena keeps its tick rate; the stall is within the catch-up bound.
    expect(
      Math.abs(sample.ticks.published - sample.ticks.dueAtTickRate)
    ).toBeLessThanOrEqual(2);
    // regression: simulation-epoch-clock-drops-snapshots
    const due = (sample.virtualMs * LIGHT_CYCLES_TIMING.snapshotRate) / 1000;
    const stalled = (W.stallMs * LIGHT_CYCLES_TIMING.snapshotRate) / 1000;
    expect(sample.snapshots.published).toBeGreaterThanOrEqual(due - stalled);
    expect(sample.snapshots.published).toBeLessThanOrEqual(due + 1);
    expect(sample.snapshots.meanBytes).toBeGreaterThan(100);
    expect(sample.snapshots.maxBytes).toBeLessThan(65_536);
    // Ordered links of 40 ± 10 ms: a snapshot is that old when accepted.
    expect(sample.snapshots.ageMs.p95).toBeLessThanOrEqual(
      W.latencyMs + W.jitterMs
    );
    expect(sample.snapshots.ageMs.mean).toBeGreaterThanOrEqual(
      W.latencyMs - W.jitterMs
    );
    // One 200 ms stall makes the authority timer wake that much late, once.
    expect(sample.schedulingDelayMs.max).toBeGreaterThan(
      W.stallMs - TICK_MS - 1
    );
    expect(sample.schedulingDelayMs.max).toBeLessThanOrEqual(W.stallMs);
    expect(sample.rejections).toEqual({
      'only the player controls this side': 2,
      'this input belongs to an earlier game': 1,
      'input future': 1,
      'input late': 1,
    });
    expect(sample.reconnects.opened).toBe(1);
    expect(sample.reconnects.welcomes).toBeGreaterThanOrEqual(1);
    for (const traffic of Object.values(sample.connections))
      expect(traffic.down.messagesPerSecond).toBeGreaterThan(0);
    for (const seat of ['white', 'black', 'red', 'blue'])
      expect(sample.acknowledged[seat]).toBeGreaterThan(0);
  }
  // Spectators add deliveries, never publications, ticks or rider inputs.
  expect(watched.snapshots.published).toBe(riders.snapshots.published);
  expect(watched.ticks).toEqual(riders.ticks);
  expect(watched.connections['carol']!.up).toEqual(
    riders.connections['carol']!.up
  );
  expect(watched.snapshots.deliveries).toBeGreaterThan(
    riders.snapshots.deliveries + riders.snapshots.published
  );
});
