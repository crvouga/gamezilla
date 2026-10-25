import { expect, test } from 'bun:test';
import {
  LIGHT_CYCLES_RIDERS,
  LIGHT_CYCLES_SEATS,
  lightCyclesConfig,
} from '@libs/light-cycles-shared-ts/light-cycles-config';
import { parseLightCyclesInput } from '@libs/light-cycles-shared-ts/light-cycles-input';
import {
  lightCyclesCheckpointKey,
  lightCyclesPhase,
  lightCyclesResult,
  lightCyclesRound,
} from '@libs/light-cycles-shared-ts/light-cycles-result';
import { retireLightCyclesRider } from '@libs/light-cycles-shared-ts/light-cycles-retire';
import { LIGHT_CYCLES_SPAWNS } from '@libs/light-cycles-shared-ts/light-cycles-spawns';
import {
  initialLightCyclesState,
  type LightCyclesState,
} from '@libs/light-cycles-shared-ts/light-cycles-state';
import {
  type LightCyclesSchedule,
  playFrom,
  runningLightCycles,
  type ScheduledTurn,
} from './light-cycles-fixture';

const config = lightCyclesConfig();
const duel = LIGHT_CYCLES_SEATS[2];

function ticks(count: number, first: readonly ScheduledTurn[] = []) {
  return Array.from({ length: count }, (_, index) =>
    index === 0 ? first : []
  ) satisfies LightCyclesSchedule;
}

function last(states: readonly LightCyclesState[]): LightCyclesState {
  return states.at(-1)!;
}

test('config, seats, spawns and rider identities are fixed and validated', () => {
  expect(config.width * config.height).toBe(1120);
  expect(config.tickRate / config.movementTicks).toBe(10);
  expect(() => lightCyclesConfig({ targetScore: 0 })).toThrow();
  expect(() => lightCyclesConfig({ targetScore: 10 })).toThrow();
  expect(lightCyclesConfig({ targetScore: 9 }).targetScore).toBe(9);
  expect(Object.values(LIGHT_CYCLES_RIDERS).map((rider) => rider.mark)).toEqual(
    ['C', 'E', 'N', 'V']
  );
  for (const spawns of Object.values(LIGHT_CYCLES_SPAWNS)) {
    const cells = new Set(spawns.map((spawn) => `${spawn.x},${spawn.y}`));
    expect(cells.size).toBe(spawns.length);
    for (const spawn of spawns) {
      const room = {
        up: spawn.y,
        down: config.height - 1 - spawn.y,
        left: spawn.x,
        right: config.width - 1 - spawn.x,
      }[spawn.heading];
      expect(room).toBeGreaterThanOrEqual(5);
    }
  }
  expect(() => initialLightCyclesState(config, ['white'])).toThrow();
  expect(() => initialLightCyclesState(config, ['black', 'white'])).toThrow();
});

test('round 1 starts in countdown with spawns marked, then runs after 90 ticks', () => {
  const initial = initialLightCyclesState(config, LIGHT_CYCLES_SEATS[4]);
  expect(initial.phase).toBe('countdown');
  expect(initial.round).toBe(1);
  expect([...initial.trails].filter((cell) => cell !== '.')).toHaveLength(4);
  expect(initial.riders.map((rider) => [rider.x, rider.y])).toEqual([
    [9, 6],
    [30, 21],
    [30, 6],
    [9, 21],
  ]);
  const states = playFrom(config, initial, ticks(config.countdownTicks));
  expect(states.at(-2)!.phase).toBe('countdown');
  expect(last(states).phase).toBe('running');
  expect(last(states).riders).toEqual(initial.riders);
  expect(lightCyclesPhase(initial)).toBe('countdown');
  expect(lightCyclesPhase(last(states))).toBe('running');
});

test('riders enter exactly one cell every third tick', () => {
  const running = runningLightCycles(config, duel);
  const states = playFrom(config, running, ticks(9));
  expect(states.map((state) => state.riders[0]!.x)).toEqual([
    9, 9, 9, 10, 10, 10, 11, 11, 11, 12,
  ]);
  expect(last(states).trails[6 * 40 + 12]).toBe('0');
  expect(last(states).trails[21 * 40 + 27]).toBe('1');
});

test('a turn queued during the countdown applies at the first movement step', () => {
  const initial = initialLightCyclesState(config, duel);
  const states = playFrom(
    config,
    initial,
    ticks(config.countdownTicks + 3, [{ seat: 'white', heading: 'up' }])
  );
  expect(last(states).riders[0]).toMatchObject({
    x: 9,
    y: 5,
    heading: 'up',
    turns: [],
  });
});

test('refused commands change nothing: other rounds, unknown seats, repeats, reversals and overflow', () => {
  const running = runningLightCycles(config, duel);
  const refused: ScheduledTurn[] = [
    { seat: 'white', heading: 'up', round: 2 },
    { seat: 'red', heading: 'up' },
    { seat: 'blue', heading: 'down' },
    { seat: 'white', heading: 'right' },
    { seat: 'white', heading: 'left' },
  ];
  const states = playFrom(config, running, ticks(1, refused));
  expect(last(states).riders).toEqual(running.riders);
  // A burst of five turns keeps only the first two legal ones.
  const burst = playFrom(
    config,
    running,
    ticks(1, [
      { seat: 'white', heading: 'up' },
      { seat: 'white', heading: 'up' },
      { seat: 'white', heading: 'down' },
      { seat: 'white', heading: 'left' },
      { seat: 'white', heading: 'down' },
    ])
  );
  expect(last(burst).riders[0]!.turns).toEqual(['up', 'left']);
  expect(last(burst).riders[1]).toEqual(running.riders[1]!);
});

test('a queued burst turns at most once per movement step and never reverses', () => {
  const running = runningLightCycles(config, duel);
  const states = playFrom(
    config,
    running,
    ticks(6, [
      { seat: 'white', heading: 'up' },
      { seat: 'white', heading: 'left' },
    ])
  );
  expect(states[3]!.riders[0]).toMatchObject({ x: 9, y: 5, heading: 'up' });
  expect(states[6]!.riders[0]).toMatchObject({ x: 8, y: 5, heading: 'left' });
});

function duelAt(
  white: { x: number; y: number; heading: 'up' | 'right' | 'down' | 'left' },
  black: { x: number; y: number; heading: 'up' | 'right' | 'down' | 'left' },
  overrides: Partial<LightCyclesState> = {}
): LightCyclesState {
  const running = runningLightCycles(config, duel);
  const cells = Array.from({ length: 1120 }, () => '.');
  cells[white.y * 40 + white.x] = '0';
  cells[black.y * 40 + black.x] = '1';
  return {
    ...running,
    phaseTick: 2,
    trails: cells.join(''),
    riders: [
      { ...running.riders[0]!, ...white },
      { ...running.riders[1]!, ...black },
    ],
    ...overrides,
  };
}

test('a lone survivor wins the round once, then a fresh rotated arena follows', () => {
  const before = duelAt(
    { x: 39, y: 0, heading: 'right' },
    { x: 20, y: 10, heading: 'left' }
  );
  const states = playFrom(config, before, ticks(1 + config.roundOverTicks));
  const over = states[1]!;
  expect(over.phase).toBe('round-over');
  expect(over.roundWinner).toBe('black');
  expect(over.scores).toEqual([0, 1]);
  expect(over.crashes).toEqual([{ seat: 'white', x: 39, y: 0, cause: 'wall' }]);
  expect(lightCyclesPhase(over)).toBe('running');
  for (const state of states.slice(1, -1)) expect(state.scores).toEqual([0, 1]);
  const next = last(states);
  expect(next).toMatchObject({ phase: 'countdown', round: 2, crashes: [] });
  expect(next.scores).toEqual([0, 1]);
  expect(next.riders.map((rider) => [rider.x, rider.y, rider.alive])).toEqual([
    [30, 21, true],
    [9, 6, true],
  ]);
  expect(lightCyclesRound(next)).toBe(2);
  expect(lightCyclesCheckpointKey(next)).not.toBe(
    lightCyclesCheckpointKey(before)
  );
  expect(lightCyclesCheckpointKey(states[2]!)).toBe(
    lightCyclesCheckpointKey(over)
  );
});

test('riders crashing together draw without inventing a winner', () => {
  const before = duelAt(
    { x: 10, y: 5, heading: 'right' },
    { x: 12, y: 5, heading: 'left' }
  );
  const over = playFrom(config, before, ticks(1))[1]!;
  expect(over.roundWinner).toBe('draw');
  expect(over.scores).toEqual([0, 0]);
  expect(over.crashes.map((crash) => crash.cause)).toEqual([
    'contested',
    'contested',
  ]);
  expect(lightCyclesResult(over)).toBeNull();
});

test('reaching the target score completes the match and the result is absorbing', () => {
  const before = duelAt(
    { x: 39, y: 0, heading: 'right' },
    { x: 20, y: 10, heading: 'left' },
    { scores: [2, 2], round: 5, roundWinner: 'white' }
  );
  const states = playFrom(
    config,
    before,
    ticks(200, [{ seat: 'black', heading: 'up' }])
  );
  const done = states[1]!;
  expect(done.phase).toBe('completed');
  expect(lightCyclesResult(done)).toEqual({
    winner: 'black',
    reason: 'target score',
  });
  for (const state of states.slice(2)) expect(state).toBe(done);
});

test('the round limit gives the match to the single leader, or a draw for tied leaders', () => {
  const leader = duelAt(
    { x: 39, y: 0, heading: 'right' },
    { x: 20, y: 10, heading: 'left' },
    { scores: [1, 1], round: 15, roundWinner: 'draw' }
  );
  expect(playFrom(config, leader, ticks(1))[1]!.result).toEqual({
    winner: 'black',
    reason: 'round limit',
  });
  const tied = duelAt(
    { x: 10, y: 5, heading: 'right' },
    { x: 12, y: 5, heading: 'left' },
    { scores: [2, 2], round: 15, roundWinner: 'white' }
  );
  const done = playFrom(config, tied, ticks(1))[1]!;
  expect(done.phase).toBe('completed');
  expect(done.result).toEqual({ winner: 'draw', reason: 'round limit' });
});

test('retiring a rider is idempotent and decides the round at the next movement step', () => {
  const running = runningLightCycles(config, duel);
  const retired = retireLightCyclesRider(running, 'white');
  expect(retired.riders[0]!.alive).toBe(false);
  expect(retired.crashes).toEqual([
    { seat: 'white', x: 9, y: 6, cause: 'retired' },
  ]);
  expect(retireLightCyclesRider(retired, 'white')).toBe(retired);
  expect(retireLightCyclesRider(running, 'red')).toBe(running);
  expect(retired.trails).toBe(running.trails);
  const states = playFrom(config, retired, ticks(3));
  expect(states[2]!.phase).toBe('running');
  expect(states[3]!).toMatchObject({
    phase: 'round-over',
    roundWinner: 'black',
  });
  expect(retireLightCyclesRider(states[3]!, 'black')).toBe(states[3]!);
});

test('direction commands accept exactly a positive round and a known heading', () => {
  expect(parseLightCyclesInput({ round: 1, heading: 'up' })).toEqual({
    round: 1,
    heading: 'up',
  });
  for (const value of [
    null,
    'up',
    { round: 0, heading: 'up' },
    { round: 1.5, heading: 'up' },
    { round: Number.NaN, heading: 'up' },
    { round: 2 ** 60, heading: 'up' },
    { round: 1, heading: 'north' },
    { round: 1 },
    { round: 1, heading: 'up', tick: 4 },
  ])
    expect(parseLightCyclesInput(value)).toBeNull();
});
