import { expect, test } from 'bun:test';
import { FixedStepSimulation } from '@libs/game-session-shared-ts/simulation-engine';
import type { SimulationInput } from '@pkgs/turn-game-shared-ts/simulation';
import {
  type RaceState,
  raceStep,
  simulationOptions,
} from './reference-simulation';

test('tick observers see committed state and exact inputs, never a failed step or superseded input', () => {
  let fail = true;
  const simulation = new FixedStepSimulation<RaceState, number>(
    { distance: 0, luck: 0, inputs: [] },
    (state, inputs, context) => {
      if (fail) throw new Error('failed before commit');
      return raceStep(state, inputs, context);
    },
    simulationOptions
  );
  const applied = { playerId: 'first', sequence: 2, tick: 1, value: 4 };
  simulation.enqueue({ ...applied, sequence: 1, tick: 2 });
  simulation.enqueue(applied);
  const ticks: { tick: number; inputs: readonly SimulationInput<number>[] }[] =
    [];
  const unsubscribe = simulation.subscribeTicks((tick, inputs) => {
    expect(simulation.snapshot().tick).toBe(tick);
    expect(simulation.snapshot().acknowledged).toEqual({ first: 2 });
    ticks.push({ tick, inputs });
  });
  expect(() => simulation.advanceTicks(1)).toThrow('failed before commit');
  expect(ticks).toEqual([]);
  fail = false;
  simulation.advanceTicks(2);
  expect(ticks).toEqual([
    { tick: 1, inputs: [applied] },
    { tick: 2, inputs: [] },
  ]);
  unsubscribe();
  simulation.advanceTicks(1);
  expect(ticks).toHaveLength(2);
});
