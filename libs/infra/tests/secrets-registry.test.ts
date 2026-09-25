import { describe, expect, test } from 'bun:test';
import { SECRETS } from '@libs/secrets/public/secrets';
import secretNames from '../tofu/stacks/foundation/secrets.json';

const byName = new Map(SECRETS.map((s) => [s.name, s]));

describe('OpenTofu secrets ↔ @libs/secrets registry', () => {
  test('the secrets OpenTofu writes are exactly the registry secrets marked managedBy tofu', () => {
    const written = [
      ...secretNames.generated,
      ...secretNames.derived,
      ...secretNames.bootstrap,
    ].sort();
    const managed = SECRETS.filter((s) => s.managedBy === 'tofu')
      .map((s) => s.name)
      .sort();
    expect(written).toEqual(managed);
  });

  test('every human secret OpenTofu asserts is a registry secret a person enters', () => {
    for (const name of secretNames.human) {
      expect({ name, managedBy: byName.get(name)?.managedBy }).toEqual({
        name,
        managedBy: null,
      });
    }
  });

  test('a secret is generated, derived or human — never two of them', () => {
    const all = [
      ...secretNames.human,
      ...secretNames.generated,
      ...secretNames.derived,
      ...secretNames.bootstrap,
    ];
    expect(all.length).toBe(new Set(all).size);
  });
});
