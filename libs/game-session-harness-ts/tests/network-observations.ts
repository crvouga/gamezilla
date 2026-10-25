import { expect } from 'bun:test';
import { CustomGamesAttr } from '@libs/game-session-shared-ts/custom-game-state';
import type { NetworkSurface } from './live-network-system';
import { decode } from './network-race';

export function networkObservation(s: NetworkSurface) {
  return {
    positions: [...s.positions.values()],
    distances: [...s.distances.values()],
    authority: CustomGamesAttr.from(s.kit.server.getCommittedState()).current
      ?.fen,
    errors: s.errors,
    stale: [...s.connections.values()].map((connection) =>
      connection.replica.isStale()
    ),
  };
}

export function assertNetworkConvergence(
  observation: ReturnType<typeof networkObservation>
) {
  expect(observation.errors).toEqual([]);
  expect(observation.positions).toHaveLength(3);
  expect(observation.stale).toEqual([false, false, false]);
  for (const history of observation.distances)
    for (let index = 1; index < history.length; index++)
      expect(history[index]!).toBeGreaterThanOrEqual(history[index - 1]!);
  const position = observation.positions[0];
  if (typeof position !== 'string') throw new Error('No presented race');
  if (typeof observation.authority !== 'string')
    throw new Error('No authoritative race');
  expect(position).toBe(observation.authority);
  for (const current of observation.positions) expect(current).toBe(position);
  const state = decode(position);
  if (state === null) throw new Error('Invalid presented race');
  expect(state.distance).toBeGreaterThan(0);
  expect(state.inputs.length).toBeGreaterThan(0);
  expect(
    state.inputs.every((input) => /:(white|black):\d+:(4|7)$/.test(input))
  ).toBe(true);
  const identities = state.inputs.map((input) =>
    input.split(':').slice(1, 3).join(':')
  );
  expect(new Set(identities).size).toBe(identities.length);
}
