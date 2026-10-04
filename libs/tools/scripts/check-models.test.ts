import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_VERIFY_STEPS,
  DEFAULT_VERIFY_TIMEOUT_MS,
} from '@pkgs/quint-shared/registry';

import {
  modelChecks,
  modelChecksFromBindings,
  modelEncodingOf,
  verifyStepsOf,
  verifyTimeoutOf,
} from './check-models';
import { specPackages } from './spec-packages';

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
    timeoutMs: 240_000,
  });
});
