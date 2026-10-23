import { expect, test } from 'bun:test';
import {
  selectVerifyPhase,
  verifyPhases,
} from '@pkgs/quint-server-ts/verify-phases';

const INPUT = {
  source: 'module proof {}',
  module: 'proof',
  invariants: [
    'invDistinctSides',
    'invOneUnfinishedGame',
    'invHonestResult',
    'invTimeControls',
    'invFairColours',
    'invClocks',
    'invRatedOnce',
    'invOffers',
    'invDevicesAgree',
    'invOfflineBoard',
    'invDeletedCannotPlay',
    'invAcceptedMoves',
  ],
  maxSteps: 2,
};

test('a phase task runs only its indexes and refuses a drifted count', () => {
  const phases = verifyPhases({ ...INPUT, boundedInvariantGroupSize: 6 });
  expect(selectVerifyPhase(phases, undefined)).toEqual({ phases });
  const second = phases[1];
  if (second === undefined) throw new Error('missing phase');
  expect(selectVerifyPhase(phases, { indexes: [1], count: 2 })).toEqual({
    phases: [second],
  });
  expect(selectVerifyPhase(phases, { indexes: [0], count: 3 })).toEqual({
    error: expect.stringContaining('3') as string,
  });
  expect(selectVerifyPhase(phases, { indexes: [2], count: 2 })).toEqual({
    error: expect.stringContaining('not among') as string,
  });
  expect(selectVerifyPhase(phases, { indexes: [], count: 2 })).toEqual({
    error: expect.stringContaining('no proof phase') as string,
  });
});

test('bounded groups retain every target and the original search bound', () => {
  // regression: quint-bounded-invariant-solver-contention
  const input = { ...INPUT, boundedInvariantGroupSize: 6 };
  const phases = verifyPhases(input);
  expect(phases).toHaveLength(2);
  expect(phases.flatMap((phase) => phase.invariants)).toEqual(INPUT.invariants);
  expect(phases.map((phase) => phase.case)).toEqual([0, 1]);
  for (const phase of phases) {
    expect(phase.name).toBe('bounded');
    expect(phase.maxSteps).toBe(2);
    expect(phase.invariants).toHaveLength(6);
  }
});

test.each([undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, 12, 99])(
  'an absent or ineffective group size %s retains one complete check',
  (boundedInvariantGroupSize) => {
    const input = {
      ...INPUT,
      ...(boundedInvariantGroupSize === undefined
        ? {}
        : { boundedInvariantGroupSize }),
    };
    expect(verifyPhases(input)).toEqual([
      { name: 'bounded', invariants: INPUT.invariants, maxSteps: 2 },
    ]);
  }
);

test.each([1, 5, 7])('groups of %s retain the final partial group', (size) => {
  const input = { ...INPUT, boundedInvariantGroupSize: size };
  const phases = verifyPhases(input);
  expect(phases.flatMap((phase) => phase.invariants)).toEqual(INPUT.invariants);
  expect(phases).toHaveLength(Math.ceil(INPUT.invariants.length / size));
  expect(new Set(phases.map((phase) => phase.case)).size).toBe(phases.length);
  for (const phase of phases) expect(phase.maxSteps).toBe(INPUT.maxSteps);
});
