import { describe, expect, test } from 'bun:test';
import { FOUNDATION_SECRETS } from '@libs/infra/public/foundation-secrets';
import { SECRETS } from '@libs/secrets/public/secrets';

const byName = new Map(SECRETS.map((s) => [s.name, s]));

describe('OpenTofu secrets ↔ @libs/secrets registry', () => {
  test('the secrets OpenTofu writes are exactly the registry secrets marked managedBy tofu', () => {
    const written = [
      ...FOUNDATION_SECRETS.generated,
      ...FOUNDATION_SECRETS.derived,
      ...FOUNDATION_SECRETS.bootstrap,
    ].sort();
    const managed = SECRETS.filter((s) => s.managedBy === 'tofu')
      .map((s) => s.name)
      .sort();
    expect(written).toEqual(managed);
  });

  test('every human secret OpenTofu asserts is a registry secret a person enters', () => {
    for (const name of FOUNDATION_SECRETS.human) {
      expect({ name, managedBy: byName.get(name)?.managedBy }).toEqual({
        name,
        managedBy: null,
      });
    }
  });

  test('every shared secret is a registry secret a person enters', () => {
    for (const name of FOUNDATION_SECRETS.shared) {
      expect({ name, managedBy: byName.get(name)?.managedBy }).toEqual({
        name,
        managedBy: null,
      });
    }
  });

  test('a secret is shared, generated, derived or human — never two of them', () => {
    const all = [
      ...FOUNDATION_SECRETS.human,
      ...FOUNDATION_SECRETS.shared,
      ...FOUNDATION_SECRETS.generated,
      ...FOUNDATION_SECRETS.derived,
      ...FOUNDATION_SECRETS.bootstrap,
    ];
    expect(all.length).toBe(new Set(all).size);
  });
});
