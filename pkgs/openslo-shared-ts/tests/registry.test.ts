import { describe, expect, test } from 'bun:test';
import {
  bindObjectives,
  objectiveSpecStem,
  objectivesBinding,
} from '@pkgs/openslo-shared-ts/registry';

describe('the registry', () => {
  test('finds a binding by its spec stem', () => {
    const binding = { spec: 'registry-probe', measure: {} };
    bindObjectives(binding);
    expect(objectivesBinding('registry-probe')).toBe(binding);
  });

  test('refuses a second binding for the same file', () => {
    bindObjectives({ spec: 'registry-twice', measure: {} });
    expect(() =>
      bindObjectives({ spec: 'registry-twice', measure: {} })
    ).toThrow('openslo: objectives registry-twice are bound twice');
  });

  test('names the file to add when a binding is missing', () => {
    expect(() => objectivesBinding('checkout')).toThrow(
      "add tests/openslo/checkout.binding.ts with bindObjectives({ spec: 'checkout', measure: { … } }) and import it from tests/openslo/index.ts"
    );
  });

  test.each([
    ['specs/sync-engine/note-delivery.openslo.yaml', 'note-delivery'],
    ['/abs/specs/billing/checkout.openslo.yml', 'checkout'],
  ])('the stem of %s', (path, stem) => {
    expect(objectiveSpecStem(path)).toBe(stem);
  });
});
