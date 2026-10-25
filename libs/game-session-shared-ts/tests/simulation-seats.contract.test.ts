import { expect, test } from 'bun:test';
import {
  simulationAbsenceWinner,
  simulationAwaitsAbsence,
} from '@libs/game-session-shared-ts/simulation-absence';
import { defineSimulation } from '@pkgs/turn-game-shared-ts/game-simulation';
import { arenaGame } from './reference-arena-game';
import { liveSessionRoom } from './reference-live-session-room';
import { requestState } from './reference-simulation-room';

test('a three-seat match gives each seated person control and keeps running while one is away', async () => {
  const rig = await liveSessionRoom(false, arenaGame, true);
  try {
    const alice = await rig.connect('alice');
    await rig.connect('bob');
    await rig.connect('carol');
    await rig.advance(2);
    expect(rig.match().execution).toMatchObject({
      phase: 'running',
      missing: [],
    });
    rig.transports.get('bob')!.closeFromServer();
    await rig.settle();
    rig.clock.advance(30_000);
    await rig.settle();
    expect(rig.match()).toMatchObject({ outcome: 'ongoing' });
    expect(rig.match().execution).toMatchObject({
      phase: 'running',
      missing: ['black'],
      expiresAt: null,
    });
    expect((await requestState(alice)).paused).toBe(false);
  } finally {
    rig.dispose();
  }
});

test('a three-seat match everyone left is aborted once and releases its work', async () => {
  const rig = await liveSessionRoom(false, arenaGame, true);
  try {
    for (const person of ['alice', 'bob', 'carol']) await rig.connect(person);
    for (const person of ['alice', 'bob', 'carol'])
      rig.transports.get(person)!.closeFromServer();
    await rig.settle();
    rig.clock.advance(30_000);
    await rig.settle();
    expect(rig.match()).toMatchObject({
      outcome: 'aborted',
      reason: 'everyone stayed away',
    });
    expect(rig.match().execution!.phase).toBe('abandoned');
    expect(rig.clock.pendingOneShotCount()).toBe(0);
    expect(rig.errors).toEqual([]);
  } finally {
    rig.dispose();
  }
});

test.each([
  [['white', 'black'], ['black'], 'white'],
  [['white', 'black'], ['white', 'black'], null],
  [['white', 'black', 'red'], ['red'], null],
  [['white', 'black', 'red', 'blue'], ['white', 'black', 'red'], null],
] as const)(
  'seats %p with %p away: the winner is %p',
  (seats, missing, winner) => {
    expect(simulationAbsenceWinner(seats, missing)).toBe(winner);
  }
);

test('a finished or present execution waits for no absence deadline', () => {
  const execution = {
    epoch: 'e',
    generation: 1,
    inputGeneration: 0,
    tick: 0,
    acknowledged: {},
    phase: 'running' as const,
    started: true,
    missing: ['red' as const],
    expiresAt: 10,
  };
  expect(simulationAwaitsAbsence(execution)).toBe(true);
  expect(simulationAwaitsAbsence({ ...execution, missing: [] })).toBe(false);
  expect(simulationAwaitsAbsence({ ...execution, phase: 'completed' })).toBe(
    false
  );
  expect(simulationAwaitsAbsence({ ...execution, expiresAt: null })).toBe(
    false
  );
});

test('registration refuses unbounded commands and an infinite grace period', () => {
  const simulation = arenaGame.registration.simulation!;
  const mechanics = {
    initialize: () => 0,
    step: (state: number) => state,
    parseInput: () => null,
    result: () => null,
  };
  const codec = { encode: String, decode: Number };
  expect(() =>
    defineSimulation(mechanics, codec, simulation.timing, {
      input: { mode: 'commands', maxPendingPerPlayer: 0, maxAgeTicks: 3 },
    })
  ).toThrow('positive integer bounds');
  expect(() =>
    defineSimulation(mechanics, codec, simulation.timing, {
      disconnection: {
        policy: 'continue',
        graceMs: Number.POSITIVE_INFINITY,
        retire: (state) => state,
      },
    })
  ).toThrow('grace must be finite');
  expect(simulation.input).toEqual({
    mode: 'commands',
    maxPendingPerPlayer: 2,
    maxAgeTicks: 10,
  });
});
