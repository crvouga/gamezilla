import { expect, test } from 'bun:test';
import { FixedStepSimulation } from '@libs/game-session-shared-ts/simulation-engine';
import {
  LIGHT_CYCLES_SEATS,
  type LightCyclesConfig,
  lightCyclesConfig,
} from '@libs/light-cycles-shared-ts/light-cycles-config';
import type { LightCyclesInput } from '@libs/light-cycles-shared-ts/light-cycles-input';
import {
  initialLightCyclesState,
  type LightCyclesState,
} from '@libs/light-cycles-shared-ts/light-cycles-state';
import { createLightCyclesStep } from '@libs/light-cycles-shared-ts/light-cycles-step';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import {
  playLightCycles,
  randomSchedule,
  scheduledInputs,
} from './light-cycles-fixture';
import {
  roundViolations,
  scoringViolations,
  shapeViolations,
} from './light-cycles-invariants';

const play = fc.record({
  seed: fc.integer(),
  count: fc.constantFrom(2 as const, 3 as const, 4 as const),
  targetScore: fc.integer({ min: 1, max: 3 }),
  density: fc.constantFrom(0.05, 0.4, 3),
});

function transitionViolations(
  before: LightCyclesState,
  after: LightCyclesState
): string[] {
  const found = scoringViolations(before, after);
  if (after.round !== before.round)
    return after.phase === 'countdown' ? found : [...found, 'round skipped'];
  const moving = before.phase === 'running' && before.phaseTick % 3 === 2;
  const still = after.riders.every(
    (rider, index) =>
      rider.x === before.riders[index]!.x && rider.y === before.riders[index]!.y
  );
  if (!moving && !still) found.push('a rider moved between movement steps');
  return [...found, ...roundViolations(before, after)];
}

test('random play keeps riders in bounds, trails monotone, motion single-cell and scoring once', () => {
  assertProperty(
    'Light Cycles simulation invariants',
    fc.property(play, ({ seed, count, targetScore, density }) => {
      const config = lightCyclesConfig({ targetScore });
      const states = playLightCycles(
        config,
        LIGHT_CYCLES_SEATS[count],
        randomSchedule(seed, 1500, count, density)
      );
      const found = states.flatMap((after, index) => {
        const shape = shapeViolations(after, config);
        const before = states[index - 1];
        if (before === undefined) return shape;
        return [...shape, ...transitionViolations(before, after)].map(
          (violation) => `tick ${index}: ${violation}`
        );
      });
      expect(found).toEqual([]);
    })
  );
});

function engine(config: LightCyclesConfig, count: 2 | 3 | 4, seed: string) {
  return new FixedStepSimulation<LightCyclesState, LightCyclesInput>(
    initialLightCyclesState(config, LIGHT_CYCLES_SEATS[count]),
    createLightCyclesStep(config),
    {
      tickRate: config.tickRate,
      seed,
      maxCatchUpTicks: config.maxCatchUpTicks,
      maxQueuedInputs: config.maxQueuedInputs,
      maxInputLeadTicks: config.maxInputLeadTicks,
    }
  );
}

test('identical initial state, seed and command schedule replay identically in any delivery order', () => {
  assertProperty(
    'Light Cycles replay determinism',
    fc.property(play, ({ seed, count, targetScore, density }) => {
      const config = lightCyclesConfig({ targetScore });
      const schedule = randomSchedule(seed, 900, count, density);
      const a = engine(config, count, String(seed));
      const b = engine(config, count, String(seed));
      for (const [index, turns] of schedule.entries()) {
        const tick = index + 1;
        const inputs = scheduledInputs(a.snapshot().state, turns, tick);
        const accepted = inputs.every((input) => a.enqueue(input).accepted);
        const reversed = [...inputs]
          .reverse()
          .every((input) => b.enqueue(input).accepted);
        if (!accepted || !reversed)
          throw new Error(`input refused at tick ${tick}`);
        a.advanceTicks(1);
        b.advanceTicks(1);
      }
      expect(b.snapshot()).toEqual(a.snapshot());
      const direct = playLightCycles(
        config,
        LIGHT_CYCLES_SEATS[count],
        schedule
      );
      expect(a.snapshot().state).toEqual(direct.at(-1)!);
    })
  );
});
