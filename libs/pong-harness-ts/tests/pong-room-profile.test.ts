import { expect, test } from 'bun:test';
import {
  pongRoomProfile,
  primePongProfile,
  readPongRoomProfile,
  samplePongRoom,
} from '@libs/pong-harness-ts/pong-room-profile';
import { pongGameShared } from '@libs/pong-shared-ts/pong-game';

test('the room profile measures real input processing and snapshot fanout over one stable virtual window', async () => {
  const samples: NonNullable<
    Awaited<ReturnType<typeof readPongRoomProfile>>
  >[] = [];
  for (const spectators of [0, 2]) {
    await using run = await pongRoomProfile.run({
      seed: 7331,
      args: { spectators },
    });
    await run.apply(primePongProfile);
    await run.apply(samplePongRoom, 1000);
    const sample = await run.read(readPongRoomProfile);
    if (sample === null) throw new Error('No room sample');
    expect(sample.endingState).not.toBeNull();
    expect(sample.endingState?.winner).toBeNull();
    expect(sample.acknowledgments['white']).toBeGreaterThan(0);
    expect(sample.acknowledgments['black']).toBeGreaterThan(0);
    expect(sample.traffic.inputs.frames).toBeGreaterThan(0);
    expect(sample.traffic.snapshots.frames).toBeGreaterThan(0);
    expect(sample.publishedTickDelta).toBeGreaterThan(0);
    const timing = pongGameShared.registration.simulation!.timing;
    const expectedTicks = Math.floor(
      (sample.virtualMs * timing.tickRate) / 1000
    );
    expect(Math.abs(sample.publishedTickDelta - expectedTicks)).toBeLessThan(
      timing.tickRate / timing.snapshotRate
    );
    expect(sample.liveCheckpointBytes).toBeGreaterThan(4);
    expect(sample.durableEventsAdded).toBeLessThan(sample.publishedTickDelta);
    expect(sample.traffic.snapshots.frames).toBe(
      sample.traffic.snapshotPublications.frames * sample.peers
    );
    expect(sample.traffic.snapshots.bytes).toBe(
      sample.traffic.snapshotPublications.bytes * sample.peers
    );
    samples.push(sample);
  }
  const [players, viewers] = samples;
  if (players === undefined || viewers === undefined)
    throw new Error('Missing fanout sample');
  expect(viewers.virtualMs).toBe(players.virtualMs);
  expect(viewers.publishedTickDelta).toBe(players.publishedTickDelta);
  expect(viewers.endingState).toEqual(players.endingState);
  expect(viewers.traffic.inputs).toEqual(players.traffic.inputs);
  expect(viewers.traffic.snapshots.frames).toBe(
    players.traffic.snapshots.frames * 2
  );
  // Joining viewers adds snapshot revisions; crossing a decimal boundary changes their JSON size.
  // Each run's actual publication bytes, above, are the independent fanout denominator.
  expect(viewers.traffic.snapshotPublications.frames).toBe(
    players.traffic.snapshotPublications.frames
  );
});
