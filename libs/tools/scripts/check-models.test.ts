import { describe, expect, test } from 'bun:test';
import { DEFAULT_VERIFY_STEPS } from '@pkgs/quint/registry';

import { modelChecks, verifyStepsOf } from './check-models';
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

describe('modelChecks', () => {
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
    const friends = specPackages().find((pkg) => pkg.dir === 'libs/friends');
    expect(friends).toBeDefined();
    if (friends === undefined) return;
    const checks = modelChecks(friends);
    expect(checks.map((check) => check.specUri)).toEqual(
      [...friends.models].sort()
    );
    const sync = specPackages().find((pkg) => pkg.dir === 'pkgs/sync-engine');
    expect(sync === undefined ? [] : modelChecks(sync)).toEqual([
      { specUri: 'specs/sync-engine/note-replication.qnt', steps: 1 },
    ]);
  });
});
