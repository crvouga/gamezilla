import { expect, test } from 'bun:test';
import { lightCyclesConfig } from '@libs/light-cycles-shared-ts/light-cycles-config';
import { defineLightCyclesMode } from '@libs/light-cycles-shared-ts/light-cycles-game';
import {
  lightCyclesModeConfig,
  lightCyclesPositionCodec,
  lightCyclesStart,
} from '@libs/light-cycles-shared-ts/light-cycles-position';
import type { LightCyclesState } from '@libs/light-cycles-shared-ts/light-cycles-state';
import { createLightCyclesStep } from '@libs/light-cycles-shared-ts/light-cycles-step';

const slow = {
  id: 'light-cycles-slow',
  count: 2,
  width: 4,
  height: 3,
  maxRounds: 3,
  movementTicks: 7,
} as const;

test('a mode may take more ticks a step; product modes keep three', () => {
  expect(lightCyclesConfig().movementTicks).toBe(3);
  expect(
    lightCyclesModeConfig({
      id: 'light-cycles-small',
      count: 2,
      width: 4,
      height: 3,
      maxRounds: 3,
    }).movementTicks
  ).toBe(3);
  expect(lightCyclesModeConfig(slow).movementTicks).toBe(7);
  expect(() => lightCyclesConfig({ movementTicks: 0 })).toThrow(
    '1 to 30 ticks'
  );
  expect(() => lightCyclesConfig({ movementTicks: 31 })).toThrow(
    '1 to 30 ticks'
  );
});

test('riders of a slower mode step once every movementTicks ticks', () => {
  const step = createLightCyclesStep(lightCyclesModeConfig(slow, 1));
  let state: LightCyclesState = {
    ...lightCyclesStart(slow, 1),
    phase: 'running',
  };
  const comet = () => state.riders[0]!;
  const context = (tick: number) => ({
    tick,
    deltaMs: 1000 / 30,
    elapsedMs: (tick * 1000) / 30,
    random: () => 0,
  });
  for (let tick = 1; tick < 7; tick++) {
    state = step(state, [], context(tick));
    expect([comet().x, comet().y]).toEqual([0, 0]);
  }
  state = step(state, [], context(7));
  expect([comet().x, comet().y]).toEqual([1, 0]);
  const game = defineLightCyclesMode(slow);
  const codec = lightCyclesPositionCodec(slow);
  expect(game.registration.rules.recognizes(codec.encode(state))).toBe(true);
});

test('a rider that crashes on a turn keeps the heading it was riding', () => {
  // regression: light-cycles-crashed-rider-takes-its-turn
  const step = createLightCyclesStep(lightCyclesModeConfig(slow, 1));
  const start = lightCyclesStart(slow, 1);
  // Comet waits on column 1, row 1 heading right, with a turn up into the edge.
  let state: LightCyclesState = {
    ...start,
    phase: 'running',
    riders: start.riders.with(0, { ...start.riders[0]!, turns: ['up'] }),
  };
  for (let tick = 1; tick <= 7; tick++)
    state = step(state, [], {
      tick,
      deltaMs: 1000 / 30,
      elapsedMs: (tick * 1000) / 30,
      random: () => 0,
    });
  const comet = state.riders[0]!;
  expect(comet.alive).toBe(false);
  expect([comet.x, comet.y, comet.heading]).toEqual([0, 0, 'right']);
  expect(state.crashes).toEqual([{ seat: 'white', x: 0, y: 0, cause: 'wall' }]);
});
