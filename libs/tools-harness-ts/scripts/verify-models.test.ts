import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import {
  DEFAULT_VERIFY_STEPS,
  DEFAULT_VERIFY_TIMEOUT_MS,
} from '@pkgs/quint-shared-ts/registry';
import fc from 'fast-check';
import {
  modelEncodingOf,
  modelPartOf,
  modelPartVerifications,
  modelPhaseOf,
  modelVerificationsFromBindings,
  verifyStepsOf,
  verifyTimeoutOf,
} from './verify-models';

describe('verifyStepsOf', () => {
  test('reads the bound a binding declares', () => {
    expect(verifyStepsOf("model: 'door',\n  verifySteps: 3,\n")).toBe(3);
  });

  test('falls back to the default without one, or without a binding', () => {
    expect(verifyStepsOf("model: 'door',\n")).toBe(DEFAULT_VERIFY_STEPS);
    expect(verifyStepsOf(null)).toBe(DEFAULT_VERIFY_STEPS);
  });
});

describe('verifyTimeoutOf', () => {
  test('reads the deadline a binding declares, underscores included', () => {
    expect(
      verifyTimeoutOf("model: 'door',\n  verifyTimeoutMs: 480_000,\n")
    ).toBe(480_000);
  });

  test('falls back to the default without one, or without a binding', () => {
    expect(verifyTimeoutOf("model: 'door',\n")).toBe(DEFAULT_VERIFY_TIMEOUT_MS);
    expect(verifyTimeoutOf(null)).toBe(DEFAULT_VERIFY_TIMEOUT_MS);
  });
});

describe('modelVerifications', () => {
  test('only an opted-in binding enables Boolean short-circuit translation', () => {
    const verifications = modelVerificationsFromBindings(
      ['specs/example/first.qnt', 'specs/example/second.qnt'],
      new Map([
        ['first', "model: 'first', verifySteps: 2, shortCircuit: true"],
        ['second', "model: 'second', verifySteps: 2"],
      ])
    );
    expect(verifications[0]).toEqual({
      specUri: 'specs/example/first.qnt',
      steps: 2,
      timeoutMs: 240_000,
      inductiveInvariant: null,
      shortCircuit: true,
    });
    expect(verifications[1]).toEqual({
      specUri: 'specs/example/second.qnt',
      steps: 2,
      timeoutMs: 240_000,
      inductiveInvariant: null,
    });
  });
  test('username solver mode retains the original bound and deadline', () => {
    // regression: username-proof-solver-timeout
    const [verify] = modelVerificationsFromBindings(
      ['specs/profile/username-changes.qnt'],
      new Map([
        [
          'username-changes',
          "model: 'username-changes', invariantMode: 'before', encoding: 'fun-arrays', inferPolymorphicTypes: false, boundedInvariantGroupSize: 6",
        ],
      ])
    );
    expect(verify).toEqual({
      specUri: 'specs/profile/username-changes.qnt',
      steps: 4,
      timeoutMs: 240_000,
      inductiveInvariant: null,
      invariantMode: 'before',
      encoding: 'fun-arrays',
      inferPolymorphicTypes: false,
      boundedInvariantGroupSize: 6,
    });
  });
  test('only an opted-in binding groups bounded targets without changing its bound or deadline', () => {
    const verifications = modelVerificationsFromBindings(
      ['specs/example/first.qnt', 'specs/example/second.qnt'],
      new Map([
        [
          'first',
          "model: 'first', verifySteps: 2, verifyTimeoutMs: 480_000, boundedInvariantGroupSize: 6",
        ],
        ['second', "model: 'second', verifySteps: 2, verifyTimeoutMs: 480_000"],
      ])
    );
    expect(verifications[0]).toEqual({
      specUri: 'specs/example/first.qnt',
      steps: 2,
      timeoutMs: 480_000,
      inductiveInvariant: null,
      boundedInvariantGroupSize: 6,
    });
    expect(verifications[1]).toEqual({
      specUri: 'specs/example/second.qnt',
      steps: 2,
      timeoutMs: 480_000,
      inductiveInvariant: null,
    });
  });
  test('only the matching binding opts into separate induction', () => {
    // regression: tools-test-unhashed-model-bindings
    const verifications = modelVerificationsFromBindings(
      ['specs/games/matched-game.qnt', 'specs/games/custom-game.qnt'],
      new Map([
        [
          'matched-game',
          "model: 'matched-game', inductiveInvariant: '_proof', separateInduction: true",
        ],
        ['custom-game', "model: 'custom-game', inductiveInvariant: '_proof'"],
      ])
    );
    expect(
      verifications
        .filter((verify) => verify.separateInduction)
        .map((verify) => verify.specUri)
    ).toEqual(['specs/games/matched-game.qnt']);
    expect(
      verifications.find(
        (verify) => verify.specUri === 'specs/games/custom-game.qnt'
      )?.separateInduction
    ).toBeUndefined();
  });
  test('preserves an explicitly selected array encoding and the default otherwise', () => {
    expect(modelEncodingOf("model: 'door', encoding: 'fun-arrays'")).toBe(
      'fun-arrays'
    );
    expect(modelEncodingOf("model: 'door'")).toBeUndefined();
    expect(modelEncodingOf(null)).toBeUndefined();
  });
});

describe('model parts', () => {
  test('--part names one share, and anything else is refused', () => {
    expect(modelPartOf([])).toBeNull();
    expect(modelPartOf(['--part', '3/14'])).toEqual({ index: 3, count: 14 });
    for (const value of ['14/14', '1', 'a/b', '-1/2', '0/0'])
      expect(() => modelPartOf(['--part', value])).toThrow('--part wants k/n');
    expect(() => modelPartOf(['--part'])).toThrow('--part wants k/n');
  });

  test('--phase names a share of one model and refuses a hole', () => {
    expect(modelPhaseOf([])).toBeNull();
    expect(modelPhaseOf(['--phase', '4/12'])).toEqual({
      indexes: [4],
      count: 12,
    });
    expect(modelPhaseOf(['--phase', '0-3,5-11/12'])?.indexes).toHaveLength(11);
    expect(() => modelPhaseOf(['--phase', '12/12'])).toThrow('--phase wants');
  });

  test('the parts of a package hold every model exactly once', () => {
    assertProperty(
      'model-verify-parts',
      fc.property(
        fc.integer({ min: 1, max: 40 }),
        fc.integer({ min: 1, max: 16 }),
        (models, count) => {
          const verifications = modelVerificationsFromBindings(
            Array.from(
              { length: models },
              (_, index) => `specs/a/model-${String(index)}.qnt`
            ),
            new Map()
          );
          const parts = Array.from({ length: count }, (_, index) =>
            modelPartVerifications(verifications, { index, count })
          );
          expect(
            parts
              .flat()
              .map((verify) => verify.specUri)
              .sort()
          ).toEqual(verifications.map((verify) => verify.specUri).sort());
          expect(modelPartVerifications(verifications, null)).toEqual(
            verifications
          );
        }
      )
    );
  });
});
