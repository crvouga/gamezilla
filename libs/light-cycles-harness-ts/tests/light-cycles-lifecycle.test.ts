import { expect, test } from 'bun:test';
import {
  type LifecycleMode,
  lightCyclesLifecycleSystem,
  playRoomLifecycle,
  type ResourceSample,
  readLifecycleRecords,
} from '@libs/light-cycles-harness-ts/light-cycles-lifecycle-system';

const IDLE: ResourceSample = {
  roomTimers: 0,
  deviceTimers: 0,
  tickSubscriptions: 0,
  roomSubscriptions: 0,
  queuedFrames: 0,
  pendingCommands: 0,
};

/**
 * One tick loop per running game. A practice runs on Alice's device: its
 * driver and her screen's frame timer. A shared Quad runs in the room: one
 * authority timer, and each of the two screens has its frame timer and its
 * signal and room subscriptions.
 */
const RUNNING: Readonly<Record<LifecycleMode, ResourceSample>> = {
  'duel-practice': {
    ...IDLE,
    deviceTimers: 2,
    tickSubscriptions: 1,
    roomSubscriptions: 3,
  },
  'quad-shared': {
    ...IDLE,
    roomTimers: 1,
    deviceTimers: 2,
    tickSubscriptions: 1,
    roomSubscriptions: 4,
  },
};

test('rooms created, played to the end, rematched and disposed leave no timers, subscriptions or sends behind', async () => {
  await using run = await lightCyclesLifecycleSystem.run({ seed: 11 });
  for (let room = 0; room < 3; room++) {
    await run.apply(playRoomLifecycle, 'duel-practice', 3);
    await run.apply(playRoomLifecycle, 'quad-shared', 3);
  }
  const records = await run.read(readLifecycleRecords);
  expect(records.map((record) => record.mode)).toEqual([
    'duel-practice',
    'quad-shared',
    'duel-practice',
    'quad-shared',
    'duel-practice',
    'quad-shared',
  ]);
  for (const record of records) {
    expect(record.errors).toEqual([]);
    expect(new Set(record.games).size).toBe(3);
    // Rematches never add a tick loop: every running sample is the same.
    expect(record.running.length).toBeGreaterThanOrEqual(3);
    for (const sample of record.running)
      expect(sample).toEqual(RUNNING[record.mode]);
    // A finished game stops its loop before the rematch starts the next.
    expect(record.between).toEqual([IDLE, IDLE, IDLE]);
    expect(record.after).toEqual(IDLE);
  }
}, 60_000);
