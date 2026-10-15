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

  // regression: github-chess-spec-trace-batch-timeout
  test('sixty-four chess parts preserve all 256 multiplayer traces in smaller batches', () => {
    const units = specUnits('specs/chess/multiplayer.qnt', '', 64);
    const parts = Array.from({ length: 64 }, (_, index) =>
      partOf(units, { index, count: 64 })
    );
    const traces = parts.map((part) =>
      part.flatMap((unit) =>
        Array.from({ length: 256 }, (_, i) => i).filter(
          (i) => i % unit.slice!.count === unit.slice!.index
        )
      )
    );
    expect(traces.flat().sort((a, b) => a - b)).toEqual(
      Array.from({ length: 256 }, (_, i) => i)
    );
    expect(Math.max(...traces.map((part) => part.length))).toBe(8);
  });

  // regression: github-matchmaking-spec-single-part-timeout
  test('eight matchmaking parts replay all 128 traces exactly once', () => {
    const units = specUnits('specs/matchmaking/matching.qnt', '', 8);
    expect(units).toEqual(specUnits('specs/matchmaking/matching.qnt', '', 1));
    const parts = Array.from({ length: 8 }, (_, index) =>
      partOf(units, { index, count: 8 })
    );
    const traces = parts.map((part) =>
      part.flatMap((unit) =>
        Array.from({ length: 128 }, (_, i) => i).filter(
          (i) => i % unit.slice!.count === unit.slice!.index
        )
      )
    );
    expect(traces.flat().sort((a, b) => a - b)).toEqual(
      Array.from({ length: 128 }, (_, i) => i)
    );
    expect(traces.every((part) => part.length === 16)).toBe(true);
  });

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

  test('stable ownership keeps unrelated units in place when weights change', () => {
    expect(paths(partOf(units, { index: 0, count: 2 }))).toEqual(['a', 'c']);
    expect(paths(partOf(units, { index: 1, count: 2 }))).toEqual(['b', 'd']);
    const changed = units.map((unit) => ({
      ...unit,
      weight: unit.weight * 10,
    }));
    for (const index of [0, 1])
      expect(paths(partOf(changed, { index, count: 2 }))).toEqual(
        paths(partOf(units, { index, count: 2 }))
      );
  });

  test('slices of one spec are distinct units', () => {
    const sliced: SpecUnit[] = [0, 1].map((index) => ({
      path: 'a',
      slice: { index, count: 2 },
      weight: 5,
    }));
    const parts = [0, 1].map((index) => partOf(sliced, { index, count: 2 }));
    expect(parts.map((p) => p.map((u) => u.slice?.index))).toEqual([[0], [1]]);
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
    const count = 128;
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
    // Adding the shared-source model needs more parts, with one trace per
    // file. Keep the existing sixteen-trace cap: a part of twelve took at
    // most 332 s on the 2-core runner (Check run 38187450396).
    for (const part of parts) {
      expect(part.flatMap(tracesOf).length).toBeLessThanOrEqual(16);
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
