import { expect, test } from 'bun:test';
import { MODELS } from './campaign-config';
import { contractPart, modelsForContractPart } from './contract-part';

test('an unset contract part proves every symbolic model', () => {
  expect(contractPart('')).toBeNull();
  expect(contractPart('  ')).toBeNull();
  expect(modelsForContractPart(MODELS, null)).toEqual(MODELS);
});

test('a contract part proves exactly one model', () => {
  const count = String(MODELS.length);
  for (const [index, model] of MODELS.entries()) {
    const selected = modelsForContractPart(
      MODELS,
      contractPart(`${String(index)}/${count}`)
    );
    expect(selected.map((item) => item.name)).toEqual([model.name]);
  }
});

test('a contract part that does not cover the suite fails closed', () => {
  expect(() => contractPart('nope')).toThrow('CONTRACT_PART=nope must be k/n');
  expect(() => contractPart('11/11')).toThrow('outside 0..n-1');
  expect(() =>
    modelsForContractPart(MODELS, { index: 0, count: MODELS.length - 1 })
  ).toThrow('does not match');
});
