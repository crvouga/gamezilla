import { expect } from 'bun:test';
import {
  challengePongInput,
  impairPongDelivery,
  interruptPongConnection,
  pongNetworkSystem,
  readPongNetwork,
  settlePongDelivery,
} from '@libs/pong-harness-ts/pong-network-system';
import { pongPositionCodec } from '@libs/pong-shared-ts/pong-game';
import type { RoomFaultProfile } from '@pkgs/room-root-harness-ts/network';

export async function verifyRecovery(
  seed: number,
  faults: RoomFaultProfile,
  hold: boolean,
  missing: 'alice' | 'bob' | 'carol'
) {
  await using run = await pongNetworkSystem.run({ seed });
  await run.apply(impairPongDelivery, faults, hold);
  await run.apply(interruptPongConnection, missing);
  await run.apply(challengePongInput);
  await run.apply(settlePongDelivery);
  const observation = await run.until(readPongNetwork, {
    pred: (view) =>
      view.views.length === 3 &&
      view.views.every((peer) => peer.paused && !peer.stale),
    maxMs: 250,
  });
  expect(observation.errors).toEqual([]);
  if (observation.authority === null)
    throw new Error('No authority after healing');
  const state = pongPositionCodec.decode(observation.authority.position);
  expect(state?.paddles.left.y).toBe(240);
  expect(state?.paddles.right.y).toBe(560);
  expect(
    observation.authority.execution.acknowledged['white'] ?? 0
  ).toBeLessThan(9000);
  expect(observation.spectatorRejection).not.toBeNull();
  for (const view of observation.views) {
    expect(view.stale).toBe(false);
    expect(view.paused).toBe(true);
    expect(view.position).toBe(observation.authority.position);
  }
  expect(observation.interruption?.offline).toBe(
    observation.interruption?.before
  );
  expect(observation.interruption?.paused).toEqual(
    missing === 'carol' ? [false, false] : [true, true]
  );
  for (const history of observation.history)
    for (let i = 1; i < history.length; i++) {
      expect(history[i]!.score.left).toBeGreaterThanOrEqual(
        history[i - 1]!.score.left
      );
      expect(history[i]!.score.right).toBeGreaterThanOrEqual(
        history[i - 1]!.score.right
      );
    }
}
