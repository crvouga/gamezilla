import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import {
  DEFAULT_VERIFY_STEPS,
  DEFAULT_VERIFY_TIMEOUT_MS,
} from '@pkgs/quint-shared/registry';
import fc from 'fast-check';
import { taskBudgetSeconds } from './check-budget';
import {
  modelChecks,
  modelChecksFromBindings,
  modelEncodingOf,
  modelPartChecks,
  modelPartOf,
  verifyStepsOf,
  verifyTimeoutOf,
} from './check-models';
import { REPO_ROOT, specPackages } from './spec-packages';

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

describe('modelChecks', () => {
  test('username solver mode retains the original bound and deadline', () => {
    // regression: username-proof-solver-timeout
    const [check] = modelChecksFromBindings(
      ['specs/profile/username-changes.qnt'],
      new Map([
        [
          'username-changes',
          "model: 'username-changes', invariantMode: 'before', encoding: 'fun-arrays', inferPolymorphicTypes: false, boundedInvariantGroupSize: 6",
        ],
      ])
    );
    expect(check).toEqual({
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
    const checks = modelChecksFromBindings(
      ['specs/example/first.qnt', 'specs/example/second.qnt'],
      new Map([
        [
          'first',
          "model: 'first', verifySteps: 2, verifyTimeoutMs: 480_000, boundedInvariantGroupSize: 6",
        ],
        ['second', "model: 'second', verifySteps: 2, verifyTimeoutMs: 480_000"],
      ])
    );
    expect(checks[0]).toEqual({
      specUri: 'specs/example/first.qnt',
      steps: 2,
      timeoutMs: 480_000,
      inductiveInvariant: null,
      boundedInvariantGroupSize: 6,
    });
    expect(checks[1]).toEqual({
      specUri: 'specs/example/second.qnt',
      steps: 2,
      timeoutMs: 480_000,
      inductiveInvariant: null,
    });
  });
  test('only the matching binding opts into separate induction', () => {
    // regression: tools-test-unhashed-model-bindings
    const checks = modelChecksFromBindings(
      ['specs/chess/multiplayer.qnt', 'specs/chess/custom-game.qnt'],
      new Map([
        [
          'multiplayer',
          "model: 'multiplayer', inductiveInvariant: '_proof', separateInduction: true",
        ],
        ['custom-game', "model: 'custom-game', inductiveInvariant: '_proof'"],
      ])
    );
    expect(
      checks
        .filter((check) => check.separateInduction)
        .map((check) => check.specUri)
    ).toEqual(['specs/chess/multiplayer.qnt']);
    expect(
      checks.find((check) => check.specUri === 'specs/chess/custom-game.qnt')
        ?.separateInduction
    ).toBeUndefined();
  });
  test('preserves an explicitly selected array encoding and the default otherwise', () => {
    expect(modelEncodingOf("model: 'door', encoding: 'fun-arrays'")).toBe(
      'fun-arrays'
    );
    expect(modelEncodingOf("model: 'door'")).toBeUndefined();
    expect(modelEncodingOf(null)).toBeUndefined();
  });
  test('lists every bound product model once, never a published language', () => {
    const uris = specPackages().flatMap((pkg) =>
      modelChecks(pkg).map((check) => check.specUri)
    );
    expect(uris.length).toBeGreaterThan(0);
    expect(new Set(uris).size).toBe(uris.length);
    expect(
      uris.every((uri) => /^specs\/[a-z0-9-]+\/[a-z0-9-]+\.qnt$/.test(uri))
    ).toBe(true);
    expect(uris.some((uri) => uri.endsWith('/events.qnt'))).toBe(false);
  });

  test("checks only the package's own models, at their bindings' bounds", () => {
    // regression: model-check-refusal-recovery-expectation
    const friends = specPackages().find(
      (pkg) => pkg.dir === 'libs/friends-harness'
    );
    expect(friends).toBeDefined();
    if (friends === undefined) return;
    const checks = modelChecks(friends);
    expect(checks.map((check) => check.specUri)).toEqual(
      [...friends.models].sort()
    );
    const sync = specPackages().find(
      (pkg) => pkg.dir === 'pkgs/sync-engine-harness'
    );
    expect(sync === undefined ? [] : modelChecks(sync)).toEqual([
      {
        specUri: 'specs/sync-engine/note-conflicts.qnt',
        steps: 8,
        inductiveInvariant: '_inductive',
        timeoutMs: DEFAULT_VERIFY_TIMEOUT_MS,
      },
      {
        specUri: 'specs/sync-engine/note-recovery.qnt',
        steps: 8,
        inductiveInvariant: null,
        timeoutMs: DEFAULT_VERIFY_TIMEOUT_MS,
      },
      {
        specUri: 'specs/sync-engine/note-refusal-recovery.qnt',
        steps: 8,
        inductiveInvariant: null,
        timeoutMs: DEFAULT_VERIFY_TIMEOUT_MS,
      },
      {
        specUri: 'specs/sync-engine/note-replication.qnt',
        steps: 1,
        inductiveInvariant: null,
        timeoutMs: DEFAULT_VERIFY_TIMEOUT_MS,
      },
    ]);
  });
});

// regression: custom-game-array-encoding-timeout
test('custom-game default encoding retains the full induction and original deadline', () => {
  const [check] = modelChecks({
    dir: 'libs/chess-root-harness',
    models: ['specs/chess/custom-game.qnt'],
  });
  expect(check).toEqual({
    specUri: 'specs/chess/custom-game.qnt',
    steps: 4,
    inductiveInvariant: '_inductive',
    separateInduction: true,
    inductionCaseGroupSize: 8,
    inferPolymorphicTypes: false,
    timeoutMs: 240_000,
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

  test('the parts of a package hold every model exactly once', () => {
    assertProperty(
      'model-check-parts',
      fc.property(
        fc.integer({ min: 1, max: 40 }),
        fc.integer({ min: 1, max: 16 }),
        (models, count) => {
          const checks = modelChecksFromBindings(
            Array.from(
              { length: models },
              (_, index) => `specs/a/model-${String(index)}.qnt`
            ),
            new Map()
          );
          const parts = Array.from({ length: count }, (_, index) =>
            modelPartChecks(checks, { index, count })
          );
          expect(
            parts
              .flat()
              .map((check) => check.specUri)
              .sort()
          ).toEqual(checks.map((check) => check.specUri).sort());
          expect(modelPartChecks(checks, null)).toEqual(checks);
        }
      )
    );
  });

  // regression: chess-model-check-outlasts-one-runner
  test('the chess models check one to a part, the slowest proof under its own budget', () => {
    const chess = specPackages().find(
      (candidate) => candidate.name === '@libs/chess-root-harness'
    )!;
    const checks = modelChecks(chess);
    const manifest = JSON.parse(
      readFileSync(join(REPO_ROOT, chess.dir, 'package.json'), 'utf8')
    ) as { modelParts: number; scripts: Record<string, string> };
    expect(manifest.scripts['check:models']).toBeUndefined();
    // Fourteen models took 788 s of proof time on a laptop; one runner
    // checks them one at a time, about twice as slowly, against 600 s.
    expect(manifest.modelParts).toBe(checks.length);
    const parts = Array.from({ length: manifest.modelParts }, (_, index) =>
      modelPartChecks(checks, { index, count: manifest.modelParts })
    );
    expect(parts.every((part) => part.length === 1)).toBe(true);
    const slowest = parts.findIndex(
      (part) => part[0]?.specUri === 'specs/chess/multiplayer.qnt'
    );
    expect(
      taskBudgetSeconds(
        `@libs/chess-root-harness#check:models:${String(slowest)}`,
        false
      )
    ).toBe(420);
  });
});
