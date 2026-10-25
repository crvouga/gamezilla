import { expect, test } from 'bun:test';
import { FixedStepSimulation } from '@libs/game-session-shared-ts/simulation-engine';
import { SimulationFailure } from '@libs/game-session-shared-ts/simulation-failure';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import type { SimulationSnapshot } from '@pkgs/turn-game-shared-ts/simulation';
import fc from 'fast-check';
import {
  type RaceState,
  raceSimulation,
  raceStep,
  simulationOptions,
} from './reference-simulation';

test('render-frame partitions cannot change fixed-step state or seeded random draws', () => {
  assertProperty(
    'simulation frame partition invariance',
    fc.property(
      fc.array(fc.integer({ min: 0, max: 40 }), {
        minLength: 1,
        maxLength: 40,
      }),
      (frames) => {
        const fragmented = raceSimulation();
        const batched = raceSimulation();
        for (const milliseconds of frames) fragmented.advance(milliseconds);
        batched.advance(frames.reduce((sum, value) => sum + value, 0));
        expect(fragmented.snapshot()).toEqual(batched.snapshot());
        expect(fragmented.snapshot().tick).toBe(
          Math.floor(
            (frames.reduce((sum, value) => sum + value, 0) * 60) / 1000
          )
        );
      }
    )
  );
});

test('simultaneous inputs have stable order independent of their arrival order', () => {
  assertProperty(
    'simulation input ordering',
    fc.property(fc.integer({ min: 1, max: 1000 }), (value) => {
      const a = raceSimulation();
      const b = raceSimulation();
      const inputs = [
        { playerId: 'bob', sequence: 1, tick: 2, value },
        { playerId: 'alice', sequence: 2, tick: 2, value },
        { playerId: 'alice', sequence: 1, tick: 2, value },
      ];
      for (const input of inputs) expect(a.enqueue(input).accepted).toBe(true);
      for (const input of [...inputs].reverse())
        expect(b.enqueue(input).accepted).toBe(true);
      a.advanceTicks(2);
      b.advanceTicks(2);
      expect(a.snapshot()).toEqual(b.snapshot());
      expect(a.snapshot().state.inputs).toEqual([
        `2:alice:1:${value}`,
        `2:alice:2:${value}`,
        `2:bob:1:${value}`,
      ]);
      expect(a.snapshot().acknowledged).toEqual({ alice: 2, bob: 1 });
    })
  );
});

test('a restored checkpoint has the same future random stream without replaying its past', () => {
  const original = raceSimulation();
  original.advanceTicks(30);
  const restored = raceSimulation();
  restored.restore(
    JSON.parse(
      JSON.stringify(original.snapshot())
    ) as SimulationSnapshot<RaceState>
  );
  original.advanceTicks(20);
  restored.advanceTicks(20);
  expect(restored.snapshot()).toEqual(original.snapshot());
});

test('input bounds reject retroactive, duplicate, invalid and excessively early intents', () => {
  const simulation = raceSimulation({
    maxQueuedInputs: 1,
    maxInputLeadTicks: 4,
  });
  const input = { playerId: 'alice', sequence: 1, tick: 1, value: 4 };
  expect(simulation.enqueue(input)).toEqual({ accepted: true });
  expect(simulation.enqueue(input)).toEqual({
    accepted: false,
    reason: 'duplicate',
  });
  expect(simulation.enqueue({ ...input, playerId: 'bob' })).toEqual({
    accepted: false,
    reason: 'full',
  });
  simulation.advanceTicks(1);
  expect(simulation.enqueue(input)).toEqual({
    accepted: false,
    reason: 'late',
  });
  expect(simulation.enqueue({ ...input, tick: 2 })).toEqual({
    accepted: false,
    reason: 'duplicate',
  });
  expect(simulation.enqueue({ ...input, tick: 6, sequence: 2 })).toEqual({
    accepted: false,
    reason: 'future',
  });
  expect(simulation.enqueue({ ...input, tick: 2, sequence: NaN })).toEqual({
    accepted: false,
    reason: 'invalid',
  });
  expect(simulation.snapshot().state.inputs).toEqual(['1:alice:1:4']);
});

test('scheduler stalls and paused wall time cannot cause unlimited catch-up', () => {
  const simulation = raceSimulation({ maxCatchUpTicks: 4 });
  expect(simulation.advance(1000)).toEqual({ advanced: 4, dropped: 56 });
  simulation.advance(5);
  simulation.setPaused(true);
  expect(simulation.advance(100_000)).toEqual({ advanced: 0, dropped: 0 });
  simulation.setPaused(false);
  expect(simulation.advance(12)).toEqual({ advanced: 0, dropped: 0 });
  simulation.advance(5);
  expect(simulation.snapshot().tick).toBe(5);
  expect(() => simulation.advance(-1)).toThrow('elapsed time');
  expect(() => simulation.advanceTicks(5)).toThrow('catch-up bound');
});

test('input acknowledgments and the committed tick survive a failed pure step atomically', () => {
  let fail = true;
  const simulation = new FixedStepSimulation<RaceState, number>(
    { distance: 0, luck: 0, inputs: [] },
    (state, inputs, context) => {
      if (fail) throw new Error('mechanics failed');
      return raceStep(state, inputs, context);
    },
    simulationOptions
  );
  simulation.enqueue({ playerId: 'alice', sequence: 1, tick: 1, value: 4 });
  expect(() => simulation.advanceTicks(1)).toThrow('mechanics failed');
  expect(simulation.snapshot().tick).toBe(0);
  expect(simulation.snapshot().acknowledged).toEqual({});
  fail = false;
  simulation.advanceTicks(1);
  expect(simulation.snapshot().state.inputs).toEqual(['1:alice:1:4']);
});

test('restoration clears old controls and retains the authoritative sequence fence', () => {
  const simulation = raceSimulation();
  simulation.enqueue({ playerId: 'alice', sequence: 9, tick: 1, value: 4 });
  simulation.restore({
    tick: 0,
    state: simulation.snapshot().state,
    acknowledged: { alice: 3 },
  });
  simulation.advanceTicks(1);
  expect(simulation.snapshot().state.inputs).toEqual([]);
  expect(
    simulation.enqueue({ playerId: 'alice', sequence: 3, tick: 2, value: 4 })
      .accepted
  ).toBe(false);
});

test('malformed scheduling options fail before execution', () => {
  for (const tickRate of [0, -1, NaN, 60.5, 1001])
    expect(() => raceSimulation({ tickRate })).toThrow('tickRate');
  expect(() => raceSimulation({ maxQueuedInputs: 0 })).toThrow(
    'maxQueuedInputs'
  );
});

test('a failing deterministic step carries the exact checkpoint, seed and inputs needed to reproduce it', () => {
  const simulation = new FixedStepSimulation<RaceState, number>(
    { distance: 0, luck: 0, inputs: [] },
    () => {
      throw new Error('invalid token motion');
    },
    simulationOptions
  );
  const input = { playerId: 'alice', sequence: 1, tick: 1, value: 4 };
  simulation.enqueue(input);
  let failure: unknown;
  try {
    simulation.advanceTicks(1);
  } catch (error) {
    failure = error;
  }
  expect(failure).toBeInstanceOf(SimulationFailure);
  if (!(failure instanceof SimulationFailure))
    throw new Error('missing simulation reproduction');
  expect(failure.reproduction).toEqual({
    options: simulationOptions,
    before: {
      tick: 0,
      state: { distance: 0, luck: 0, inputs: [] },
      acknowledged: {},
    },
    inputs: [input],
  });
  expect(failure.cause).toBeInstanceOf(Error);
});
