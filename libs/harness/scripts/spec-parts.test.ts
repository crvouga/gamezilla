import { describe, expect, test } from 'bun:test';
import { MODEL_WEIGHT, partOf, specWeight } from './spec-parts';

describe('specWeight', () => {
  test('counts scenarios and outline example rows', () => {
    const feature = [
      'Feature: f',
      '  Scenario: one',
      '    Given x',
      '  Scenario Outline: many',
      '    Given <n>',
      '    Examples:',
      '      | n |',
      '      | 1 |',
      '      | 2 |',
      '  Example: two',
      '    Given y',
    ].join('\n');
    expect(specWeight('a.feature', feature)).toBe(4);
  });

  test('a model weighs a fixed amount; an empty feature weighs 1', () => {
    expect(specWeight('m.qnt', '')).toBe(MODEL_WEIGHT);
    expect(specWeight('a.feature', 'Feature: f')).toBe(1);
  });
});

describe('partOf', () => {
  const specs = [
    { path: 'a', weight: 10 },
    { path: 'b', weight: 6 },
    { path: 'c', weight: 5 },
    { path: 'd', weight: 1 },
  ];

  test('every spec lands in exactly one part', () => {
    const parts = [0, 1, 2].map((index) => partOf(specs, { index, count: 3 }));
    expect(parts.flat().sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  test('heaviest first onto the lightest part; part 0 carries tests/harness', () => {
    expect(partOf(specs, { index: 0, count: 2 })).toEqual(['b', 'c']);
    expect(partOf(specs, { index: 1, count: 2 })).toEqual(['a', 'd']);
  });

  test('more parts than specs leaves parts empty', () => {
    expect(partOf(specs.slice(0, 1), { index: 0, count: 2 })).toEqual([]);
    expect(partOf(specs.slice(0, 1), { index: 1, count: 2 })).toEqual(['a']);
  });
});
