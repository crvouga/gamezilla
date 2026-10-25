import { expect, test } from 'bun:test';
import { SimulationRetirement } from '@libs/game-session-shared-ts/simulation-retirement';
import {
  ARENA_GRACE_MS,
  type ArenaState,
  arenaSimulation,
} from './reference-arena-game';

const TICK_MS = 1000 / arenaSimulation.timing.tickRate;
const GRACE_TICKS = Math.ceil(ARENA_GRACE_MS / TICK_MS);
const context = (tick: number) => ({
  tick,
  deltaMs: TICK_MS,
  elapsedMs: tick * TICK_MS,
  random: () => 0,
});
const riding: ArenaState = { round: 2, ticks: 0, log: [], retired: [] };
/** The step that begins a round: every seat rides again. */
const beginRound = (state: unknown) => ({
  ...(state as ArenaState),
  retired: [],
});

test('a seat away past its grace is retired in the state the step that begins a round publishes', () => {
  // regression: simulation-retirement-away-seat-rides-at-round-start
  const retirement = new SimulationRetirement(arenaSimulation);
  retirement.absent(['black'], 0);
  const step = retirement.wrap(beginRound);
  const due = 1 + GRACE_TICKS;
  expect((step(riding, [], context(due - 1)) as ArenaState).retired).toEqual(
    []
  );
  expect((step(riding, [], context(due)) as ArenaState).retired).toEqual([
    'black',
  ]);
});

test('retirement before and after a step applies each due seat once, in seat order', () => {
  const retirement = new SimulationRetirement(arenaSimulation);
  retirement.absent(['red', 'black'], 0);
  const step = retirement.wrap((state) => state);
  const after = step(riding, [], context(1 + GRACE_TICKS)) as ArenaState;
  expect(after.retired).toEqual(['black', 'red']);
  expect(after.log.filter((entry) => entry.includes('retire'))).toHaveLength(2);
});

test('a returning seat is never retired again', () => {
  const retirement = new SimulationRetirement(arenaSimulation);
  retirement.absent(['black'], 0);
  retirement.absent([], 3);
  const step = retirement.wrap(beginRound);
  expect(
    (step(riding, [], context(10 * GRACE_TICKS)) as ArenaState).retired
  ).toEqual([]);
});
