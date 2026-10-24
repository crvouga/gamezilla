import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { quintModuleName } from '@pkgs/quint-server-ts/model-source';
import { modelInvariants } from '@pkgs/quint-server-ts/simulate';
import { verifyPhases } from '@pkgs/quint-server-ts/verify-phases';
import {
  DEFAULT_VERIFY_STEPS,
  DEFAULT_VERIFY_TIMEOUT_MS,
} from '@pkgs/quint-shared-ts/registry';
import fc from 'fast-check';
import { REPO_ROOT, specPackages } from './spec-packages';
import { taskBudgetSeconds } from './verify-budget';
import {
  modelEncodingOf,
  modelPartOf,
  modelPartVerifications,
  modelPhaseOf,
  modelVerifications,
  modelVerificationsFromBindings,
  verifyStepsOf,
  verifyTimeoutOf,
} from './verify-models';
import { profileBudgetSeconds } from './verify-profile';

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
  test('lists every bound product model once, never a published language', () => {
    const uris = specPackages().flatMap((pkg) =>
      modelVerifications(pkg).map((verify) => verify.specUri)
    );
    expect(uris.length).toBeGreaterThan(0);
    expect(new Set(uris).size).toBe(uris.length);
    expect(
      uris.every((uri) => /^specs\/[a-z0-9-]+\/[a-z0-9-]+\.qnt$/.test(uri))
    ).toBe(true);
    expect(uris.some((uri) => uri.endsWith('/events.qnt'))).toBe(false);
  });

  test("verifies only the package's own models, at their bindings' bounds", () => {
    // regression: model-verify-refusal-recovery-expectation
    const friends = specPackages().find(
      (pkg) => pkg.dir === 'libs/friends-harness-ts'
    );
    expect(friends).toBeDefined();
    if (friends === undefined) return;
    const verifications = modelVerifications(friends);
    expect(verifications.map((verify) => verify.specUri)).toEqual(
      [...friends.models].sort()
    );
    const sync = specPackages().find(
      (pkg) => pkg.dir === 'pkgs/sync-engine-harness-ts'
    );
    expect(sync === undefined ? [] : modelVerifications(sync)).toEqual([
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
// regression: model-proof-scheduling-expectation
test('custom-game default encoding retains the full induction and original deadline', () => {
  const [verify] = modelVerifications({
    dir: 'libs/games-harness-ts',
    models: ['specs/games/custom-game.qnt'],
  });
  expect(verify).toEqual({
    specUri: 'specs/games/custom-game.qnt',
    steps: 4,
    inductiveInvariant: '_inductive',
    separateInduction: true,
    inductionCaseGroupSize: 8,
    inferPolymorphicTypes: false,
    invariantMode: 'before',
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

  test('--phase names a share of one model and refuses a hole', () => {
    expect(modelPhaseOf([])).toBeNull();
    expect(modelPhaseOf(['--phase', '4/12'])).toEqual({
      indexes: [4],
      count: 12,
    });
    expect(modelPhaseOf(['--phase', '0-3,5-11/12'])?.indexes).toHaveLength(11);
    expect(() => modelPhaseOf(['--phase', '12/12'])).toThrow('--phase wants');
  });

  // ~2 s alone, but its wall time is the machine's: beside the other tasks of a
  // CI shard it measured 6.1 s and tripped bun's default 5 s timeout. The
  // assertions are exact; the timeout only bounds a hang.
  const LOADED_MACHINE_TIMEOUT_MS = 60_000;

  test(
    'matching isolates pairUp and overlaps the other phases in one task',
    () => {
      const matching = specPackages().find(
        (candidate) => candidate.name === '@pkgs/matchmaking-root-harness-ts'
      )!;
      const manifest = JSON.parse(
        readFileSync(join(REPO_ROOT, matching.dir, 'package.json'), 'utf8')
      ) as {
        proofParts: number;
        proofGroups: readonly string[];
        scripts: Record<string, string>;
      };
      const specUri = 'specs/matchmaking/matching.qnt';
      const source = readFileSync(join(REPO_ROOT, specUri), 'utf8');
      const phases = verifyPhases({
        source,
        module: quintModuleName(specUri),
        invariants: modelInvariants(source),
        maxSteps: 4,
        inductiveInvariant: '_proof',
        separateInduction: true,
      });
      expect(phases).toHaveLength(manifest.proofParts);
      expect(manifest.proofGroups).toEqual(['4', '0-3,5-11']);
      expect(manifest.scripts['verify:models']).toBeUndefined();
      expect(phases[4]?.step).toContain('pairUp');
      for (const [index, phase] of phases.entries()) {
        if (index !== 4) expect(phase.step ?? '').not.toContain('pairUp');
      }
      // regression: randomized-budget-tests-inherit-nightly
      expect(
        taskBudgetSeconds(
          '@pkgs/matchmaking-root-harness-ts#verify:models:0',
          false,
          { ...process.env, VERIFY_TIME_LIMITS: 'on' }
        )
      ).toBe(profileBudgetSeconds(480));
      expect(
        taskBudgetSeconds(
          '@pkgs/matchmaking-root-harness-ts#verify:models:1',
          false,
          { ...process.env, VERIFY_TIME_LIMITS: 'on' }
        )
      ).toBe(profileBudgetSeconds(480));
    },
    LOADED_MACHINE_TIMEOUT_MS
  );

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

  // regression: chess-model-proof-part-registration
  // regression: chess-model-verify-outlasts-one-runner
  // regression: phased-model-budget-contract
  test.each([
    { name: '@libs/chess-root-harness-ts', slowest: null },
    { name: '@libs/games-harness-ts', slowest: 'specs/games/matched-game.qnt' },
  ])(
    '$name verifies its models one to a part, the slowest proof under its own budget',
    ({ name, slowest }) => {
      const pkg = specPackages().find((candidate) => candidate.name === name)!;
      const verifications = modelVerifications(pkg);
      const manifest = JSON.parse(
        readFileSync(join(REPO_ROOT, pkg.dir, 'package.json'), 'utf8')
      ) as {
        modelParts: number;
        phaseParts?: Record<string, number>;
        scripts: Record<string, string>;
      };
      expect(manifest.scripts['verify:models']).toBeUndefined();
      // Fourteen models took 788 s of proof time on a laptop; one runner
      // verifies them one at a time, about twice as slowly, against 600 s.
      expect(manifest.modelParts).toBe(verifications.length);
      const parts = Array.from({ length: manifest.modelParts }, (_, index) =>
        modelPartVerifications(verifications, {
          index,
          count: manifest.modelParts,
        })
      );
      expect(parts.every((part) => part.length === 1)).toBe(true);
      if (slowest === null) {
        expect(manifest.phaseParts).toBeUndefined();
        return;
      }
      // The matched-game model proves each invariant in its own phase.
      const part = parts.findIndex((each) => each[0]?.specUri === slowest);
      const phases = manifest.phaseParts?.[String(part)];
      expect(phases).toBeGreaterThan(0);
      for (let index = 0; index < phases!; index++) {
        const task = `verify:models:${String(part)}:${String(index)}`;
        expect(manifest.scripts[task]).toContain(
          `--phase ${String(index)}/${String(phases)}`
        );
        expect(
          taskBudgetSeconds(`${name}#${task}`, false, {
            ...process.env,
            VERIFY_TIME_LIMITS: 'on',
          })
        ).toBe(profileBudgetSeconds(420));
      }
    }
  );
});
