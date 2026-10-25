import { expect, test } from 'bun:test';
import {
  type LightCyclesDifficulty,
  lightCyclesBotInput,
} from '@libs/light-cycles-shared-ts/light-cycles-bot';
import {
  LIGHT_CYCLES_SEATS,
  type LightCyclesConfig,
  type LightCyclesRiderCount,
  lightCyclesConfig,
} from '@libs/light-cycles-shared-ts/light-cycles-config';
import { isReversal } from '@libs/light-cycles-shared-ts/light-cycles-heading';
import { parseLightCyclesInput } from '@libs/light-cycles-shared-ts/light-cycles-input';
import {
  initialLightCyclesState,
  type LightCyclesState,
  plannedHeading,
  trailMark,
} from '@libs/light-cycles-shared-ts/light-cycles-state';
import { createLightCyclesStep } from '@libs/light-cycles-shared-ts/light-cycles-step';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import {
  playLightCycles,
  randomSchedule,
  runningLightCycles,
  scheduledInputs,
  stepContext,
} from './light-cycles-fixture';

const config = lightCyclesConfig();
const bot = lightCyclesBotInput(config);
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

test('bot commands are valid, fenced to the round and never a reversal', () => {
  assertProperty(
    'Light Cycles bot commands',
    fc.property(
      fc.integer(),
      fc.constantFrom(2 as const, 3 as const, 4 as const),
      fc.constantFrom(...DIFFICULTIES),
      (seed, count, difficulty) => {
        const states = playLightCycles(
          config,
          LIGHT_CYCLES_SEATS[count],
          randomSchedule(seed, 600, count, 0.4)
        );
        for (const [tick, state] of states.entries())
          for (const rider of state.riders) {
            const context = stepContext(config, String(seed), tick + 1);
            const input = bot(state, rider.seat, difficulty, context);
            expect(parseLightCyclesInput(input)).toEqual(input);
            expect(input.round).toBe(state.round);
            expect(isReversal(plannedHeading(rider), input.heading)).toBe(
              false
            );
          }
      }
    )
  );
}, 60_000);

function duel(
  white: Pick<LightCyclesState['riders'][number], 'x' | 'y' | 'heading'>,
  black: Pick<LightCyclesState['riders'][number], 'x' | 'y' | 'heading'>
): LightCyclesState {
  const running = runningLightCycles(config, LIGHT_CYCLES_SEATS[2]);
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
  };
}

const steady = { ...stepContext(config, 'bot', 1), random: () => 0.99 };

test('a bot turns away from a wall, preferring left on equal space', () => {
  const state = duel(
    { x: 39, y: 5, heading: 'right' },
    { x: 10, y: 20, heading: 'left' }
  );
  for (const difficulty of DIFFICULTIES)
    expect(bot(state, 'white', difficulty, steady).heading).toBe('up');
  const cornered = duel(
    { x: 39, y: 0, heading: 'right' },
    { x: 10, y: 20, heading: 'left' }
  );
  expect(bot(cornered, 'white', 'hard', steady).heading).toBe('down');
});

test('hard and medium bots steer away from a cell another rider may enter', () => {
  const state = duel(
    { x: 10, y: 5, heading: 'right' },
    { x: 12, y: 5, heading: 'left' }
  );
  expect(bot(state, 'white', 'hard', steady).heading).toBe('up');
  expect(bot(state, 'white', 'medium', steady).heading).toBe('up');
  expect(bot(state, 'white', 'easy', steady).heading).toBe('right');
});

test('a bot only decides on the tick before a movement step', () => {
  const state = duel(
    { x: 39, y: 5, heading: 'right' },
    { x: 10, y: 20, heading: 'left' }
  );
  for (const phaseTick of [0, 1, 3, 4])
    expect(bot({ ...state, phaseTick }, 'white', 'hard', steady).heading).toBe(
      'right'
    );
  const countdown = initialLightCyclesState(config, LIGHT_CYCLES_SEATS[2]);
  expect(bot(countdown, 'black', 'hard', steady).heading).toBe('left');
  expect(() => bot(countdown, 'red', 'hard', steady)).toThrow();
});

/** Movement steps each rider survived, per finished round, over a bounded match. */
function survival(
  chosen: LightCyclesConfig,
  count: LightCyclesRiderCount,
  difficulty: LightCyclesDifficulty | 'straight',
  seed: string
): number[] {
  const step = createLightCyclesStep(chosen);
  let state = initialLightCyclesState(chosen, LIGHT_CYCLES_SEATS[count]);
  const survived: number[] = [];
  for (let tick = 1; tick <= 6000 && state.phase !== 'completed'; tick++) {
    const context = stepContext(chosen, seed, tick);
    const before: LightCyclesState = state;
    const turns =
      difficulty === 'straight'
        ? []
        : before.seats.map((seat) => ({
            seat,
            heading: bot(before, seat, difficulty, context).heading,
          }));
    state = step(before, scheduledInputs(before, turns, tick), context);
    if (before.phase === 'running' && state.phase !== 'running')
      for (const seat of state.seats)
        survived.push(state.trails.split(trailMark(seat)).length - 2);
  }
  return survived;
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

test('bots survive at least as long as straight-only riders on average', () => {
  const chosen = lightCyclesConfig({ targetScore: 2, maxRounds: 4 });
  for (const count of [2, 3, 4] as const) {
    const straight = mean(survival(chosen, count, 'straight', 'compare'));
    for (const difficulty of DIFFICULTIES) {
      const steered = mean(survival(chosen, count, difficulty, 'compare'));
      expect(steered).toBeGreaterThanOrEqual(straight);
    }
  }
}, 60_000);
