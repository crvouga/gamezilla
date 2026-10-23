import { expect, test } from 'bun:test';
import {
  bindingForParameters,
  validateRegressionScopes,
} from '@pkgs/quint-server-ts/regression-parameters';
import type {
  ModelParameters,
  QuintBinding,
} from '@pkgs/quint-shared-ts/registry';

type Regression = NonNullable<QuintBinding<unknown>['regressions']>[number];
const pin = (id: string, parameters?: ModelParameters): Regression => ({
  id,
  title: id,
  seed: '0x67932',
  itf: {},
  ...(parameters === undefined ? {} : { parameters }),
});
const cases = [{ LOCKED: false }, { LOCKED: true }];
const binding = (
  regressions: readonly Regression[]
): QuintBinding<unknown> => ({
  model: 'parameterized-door',
  regressions,
  actions: {},
  observe: async () => ({}),
});

test('unscoped pins apply everywhere and scoped pins preserve their input case and order', () => {
  const pins = [pin('all'), pin('closed', cases[0]), pin('open', cases[1])];
  validateRegressionScopes(pins, cases);
  expect(
    bindingForParameters(binding(pins), cases[0]!).regressions?.map((p) => p.id)
  ).toEqual(['all', 'closed']);
  expect(
    bindingForParameters(binding(pins), cases[1]!).regressions?.map((p) => p.id)
  ).toEqual(['all', 'open']);
  const original = binding([]);
  expect(bindingForParameters(original, {}).regressions).toEqual([]);
  const noPins = {
    model: original.model,
    actions: original.actions,
    observe: original.observe,
  };
  expect(bindingForParameters(noPins, {})).toBe(noPins);
});

test('unknown, partial and non-Boolean scopes fail instead of losing replay coverage', () => {
  const invalid = [
    {},
    { OTHER: true },
    { LOCKED: true, OTHER: false },
    { LOCKED: 'true' },
    null,
    [],
  ];
  for (const value of invalid) {
    const pins = [pin('invalid', value as ModelParameters)];
    expect(() => validateRegressionScopes(pins, cases)).toThrow(
      'assign exactly'
    );
    expect(() => bindingForParameters(binding(pins), cases[0]!)).toThrow(
      'assign exactly'
    );
  }
  expect(() =>
    validateRegressionScopes(
      [pin('incomplete', { LOCKED: true })],
      [{ LOCKED: false, ONLINE: true }]
    )
  ).toThrow('assign exactly');
});

test('a complete but unsupported scope cannot silently drop a pinned history', () => {
  expect(() =>
    validateRegressionScopes(
      [pin('unsupported', { LOCKED: true })],
      [{ LOCKED: false }]
    )
  ).toThrow('no registered model case');
  expect(() => validateRegressionScopes([], [])).toThrow('empty model matrix');
  validateRegressionScopes([pin('global'), pin('no-inputs', {})], [{}]);
});
