import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isSyntheticFeatureSource } from '@pkgs/gherkin-shared/tags';
import { isLiveObjectiveSource } from '@pkgs/openslo-shared/live';
import { SPEC_GLOBS } from './spec-check-kinds';
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

  test('the chess suite keeps model traces inside the 600s task cap', () => {
    // regression: chess-spec-trace-batches — 32 parts put 20 traces in one task.
    const count = 64;
    const parts = chessSuiteParts(count);
    const tracesOf = (unit: SpecUnit) =>
      unit.path.endsWith('.qnt')
        ? Array.from({ length: 64 }, (_, index) => index).filter(
            (index) =>
              index % (unit.slice?.count ?? 1) === (unit.slice?.index ?? 0)
          )
        : [];
    const models = [
      ...new Set(
        parts
          .flat()
          .flatMap((unit) => (unit.path.endsWith('.qnt') ? [unit.path] : []))
      ),
    ];
    expect(models.length).toBeGreaterThan(0);
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
      expect(part.flatMap(tracesOf).length).toBeLessThanOrEqual(12);
      for (const unit of part)
        expect(tracesOf(unit).length).toBeLessThanOrEqual(2);
    }
  });
});

/** The chess harness assignment at `count` parts, using the same spec files. */
function chessSuiteParts(count: number): readonly (readonly SpecUnit[])[] {
  const dir = join(import.meta.dir, '../../../specs/chess');
  const files = [
    ...new Set(
      SPEC_GLOBS.flatMap((glob) => [
        ...new Bun.Glob(glob).scanSync({ cwd: dir }),
      ])
    ),
  ]
    .filter((file) => file !== 'events.qnt')
    .sort();
  const units = files.flatMap((file) => {
    const source = readFileSync(join(dir, file), 'utf8');
    if (file.endsWith('.feature') && isSyntheticFeatureSource(source))
      return [];
    if (file.endsWith('.openslo.yaml') && isLiveObjectiveSource(source))
      return [];
    return specUnits(join('specs/chess', file), source, count);
  });
  return Array.from({ length: count }, (_, index) =>
    partOf(units, { index, count })
  );
}
