import { describe, expect, test } from 'bun:test';
import type { SpecUnit } from './spec-parts';
import {
  CHECK_WEIGHT,
  MODEL_SLICES,
  MODEL_WEIGHT,
  partOf,
  SLICE_SCENARIOS,
  specUnits,
  specWeight,
} from './spec-parts';

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

describe('specUnits', () => {
  const scenarios = (n: number): string =>
    [
      'Feature: f',
      ...Array.from({ length: n }, (_, i) => `  Scenario: s${String(i)}`),
    ].join('\n');

  test('a short feature is one file', () => {
    expect(specUnits('a.feature', scenarios(SLICE_SCENARIOS))).toEqual([
      { path: 'a.feature', weight: SLICE_SCENARIOS },
    ]);
  });

  test('a long feature is sliced; the slices cover its weight', () => {
    const units = specUnits('a.feature', scenarios(SLICE_SCENARIOS * 2 + 1));
    expect(units.map((u) => u.slice)).toEqual([
      { index: 0, count: 3 },
      { index: 1, count: 3 },
      { index: 2, count: 3 },
    ]);
    expect(units.reduce((sum, u) => sum + u.weight, 0)).toBe(
      SLICE_SCENARIOS * 2 + 1
    );
  });

  test('a model spreads its traces over MODEL_SLICES files', () => {
    expect(specUnits('m.qnt', '')).toHaveLength(MODEL_SLICES);
  });

  test('a decision table, structure or objective is one unit', () => {
    for (const path of ['a.dmn', 's.als', 'o.openslo.yaml']) {
      expect(specUnits(path, 'Scenario: x\n'.repeat(20))).toEqual([
        { path, weight: CHECK_WEIGHT },
      ]);
    }
  });
});

describe('partOf', () => {
  const unit = (path: string, weight: number): SpecUnit => ({ path, weight });
  const units = [unit('a', 10), unit('b', 6), unit('c', 5), unit('d', 1)];
  const paths = (list: readonly SpecUnit[]) => list.map((u) => u.path);

  // regression: github-chess-board-spec-single-part-timeout
  test('eight board parts retain every unit of the original seven-model suite', () => {
    const original = Array.from(
      { length: 7 },
      (_, i) => `specs/chess-board/model-${i}.qnt`
    ).flatMap((path) => specUnits(path, '', 1));
    const split = [...new Set(original.map((u) => u.path))].flatMap((path) =>
      specUnits(path, '', 8)
    );
    expect(split).toEqual(original);
    const parts = Array.from({ length: 8 }, (_, index) =>
      partOf(split, { index, count: 8 })
    );
    expect(
      parts
        .flat()
        .sort(
          (a, b) =>
            a.path.localeCompare(b.path) || a.slice!.index - b.slice!.index
        )
    ).toEqual(original);
    expect(Math.max(...parts.map((part) => part.length))).toBe(7);
  });

  test('every unit lands in exactly one part', () => {
    const parts = [0, 1, 2].map((index) => partOf(units, { index, count: 3 }));
    expect(paths(parts.flat()).sort()).toEqual(['a', 'b', 'c', 'd']);
  });

  test('heaviest first onto the lightest part; part 0 carries tests/harness', () => {
    expect(paths(partOf(units, { index: 0, count: 2 }))).toEqual(['b', 'c']);
    expect(paths(partOf(units, { index: 1, count: 2 }))).toEqual(['a', 'd']);
  });

  test('slices of one spec are distinct units', () => {
    const sliced: SpecUnit[] = [0, 1].map((index) => ({
      path: 'a',
      slice: { index, count: 2 },
      weight: 5,
    }));
    const parts = [0, 1].map((index) => partOf(sliced, { index, count: 2 }));
    expect(parts.map((p) => p.map((u) => u.slice?.index))).toEqual([[1], [0]]);
  });

  test('the three friends models retain all traces in bounded batches', () => {
    // regression: spec-model-part-budget
    // regression: spec-task-batches-over-budget
    const models = [
      'specs/friends/friendship.qnt',
      'specs/spaces/space-hosting.qnt',
      'specs/spaces/space-recovery.qnt',
    ];
    const units = models.flatMap((path) => specUnits(path, '', 64));
    const parts = Array.from({ length: 64 }, (_, index) =>
      partOf(units, { index, count: 64 })
    );
    const tracesOf = (unit: SpecUnit) =>
      Array.from({ length: 64 }, (_, index) => index).filter(
        (index) => index % (unit.slice?.count ?? 1) === (unit.slice?.index ?? 0)
      );
    for (const path of models) {
      const traces = parts
        .flat()
        .filter((unit) => unit.path === path)
        .flatMap(tracesOf);
      expect(traces.sort((a, b) => a - b)).toEqual(
        Array.from({ length: 64 }, (_, index) => index)
      );
    }
    for (const part of parts) {
      expect(part.flatMap(tracesOf).length).toBeLessThanOrEqual(4);
      for (const unit of part)
        expect(tracesOf(unit).length).toBeLessThanOrEqual(2);
    }
  });
});
