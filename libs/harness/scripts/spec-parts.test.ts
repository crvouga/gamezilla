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
  modelDrawBatches,
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
  test('sixty-four parts preserve all 256 matched-game traces in smaller batches', () => {
    const units = specUnits('specs/games/matched-game.qnt', '', 64);
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

  /**
   * The suites whose part counts their model traces decide: every trace of
   * every model runs once, a part replays at most sixteen (a part of twelve
   * took at most 332 s on the 2-core runner, Check run 38187450396, so
   * sixteen stay near 443 s inside the 600 s cap; twenty was the miss), and
   * a model file holds at most `unitTraces` of them. The shared games suite
   * replays each trace for one game, and the traces taking every action for
   * each game, in the same parts. Chess, down to its ten puzzle and Lichess
   * models, keeps four traces to a file: sixteen to a part, as before.
   */
  const TRACE_CAPPED_SUITES = [
    { dir: 'libs/chess-root-harness', unitTraces: 4 },
    { dir: 'libs/games-harness', unitTraces: 4 },
  ] as const;

  test.each(TRACE_CAPPED_SUITES)(
    '$dir keeps model traces inside the 600s task cap',
    ({ dir, unitTraces }) => {
      // regression: chess-spec-trace-batches — 32 parts put 20 traces in one task.
      // regression: chess-spec-slice-weight
      // regression: network-model-overfills-chess-shard
      const manifest = JSON.parse(
        readFileSync(
          join(import.meta.dir, '../../..', dir, 'package.json'),
          'utf8'
        )
      ) as { specParts: number; specDomains: readonly string[] };
      const parts = suiteParts(manifest.specDomains, manifest.specParts);
      const tracesOf = modelTraces;
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
        expect(part.flatMap(tracesOf).length).toBeLessThanOrEqual(16);
        for (const unit of part)
          expect(tracesOf(unit).length).toBeLessThanOrEqual(unitTraces);
      }
    }
  );

  test('the chess suite runs in the fewest parts its trace cap allows', () => {
    const manifest = JSON.parse(
      readFileSync(
        join(import.meta.dir, '../../chess-root-harness/package.json'),
        'utf8'
      )
    ) as { specParts: number };
    const mostTraces = (count: number) =>
      Math.max(
        ...suiteParts(['chess'], count).map(
          (part) => part.flatMap(modelTraces).length
        )
      );
    expect(mostTraces(manifest.specParts)).toBeLessThanOrEqual(16);
    expect(mostTraces(manifest.specParts - 1)).toBeGreaterThan(16);
  });
});

/** The 64 traces a model unit stands for, sliced: none for any other spec. */
function modelTraces(unit: SpecUnit): readonly number[] {
  return unit.path.endsWith('.qnt')
    ? Array.from({ length: 64 }, (_, index) => index).filter(
        (index) => index % (unit.slice?.count ?? 1) === (unit.slice?.index ?? 0)
      )
    : [];
}

/** A suite's assignment at `count` parts, using its domains' spec files. */
function suiteParts(
  domains: readonly string[],
  count: number
): readonly (readonly SpecUnit[])[] {
  const units = domains.flatMap((domain) => {
    const dir = join(import.meta.dir, '../../../specs', domain);
    const files = [
      ...new Set(
        SPEC_GLOBS.flatMap((glob) => [
          ...new Bun.Glob(glob).scanSync({ cwd: dir }),
        ])
      ),
    ]
      .filter((file) => file !== 'events.qnt')
      .sort();
    return files.flatMap((file) => {
      const source = readFileSync(join(dir, file), 'utf8');
      if (file.endsWith('.feature') && isSyntheticFeatureSource(source))
        return [];
      if (file.endsWith('.openslo.yaml') && isLiveObjectiveSource(source))
        return [];
      return specUnits(join('specs', domain, file), source, count);
    });
  });
  return Array.from({ length: count }, (_, index) =>
    partOf(units, { index, count })
  );
}

// regression: chess-model-preparation-timeout
test('preparation retains every draw and bounds the workers for the combined chess suite', () => {
  const draws = [
    [96, 14],
    [256, 24],
    [16, 8],
    [96, 18],
    [16, 24],
    [64, 16],
    [32, 16],
    [32, 16],
    [32, 12],
    [80, 120],
    [48, 48],
    [32, 24],
    [64, 64],
    [24, 32],
    [16, 8],
    [24, 12],
    [48, 18],
    [64, 32],
    [24, 12],
    [6, 8],
    [16, 8],
  ].map(([traces, maxSteps], index) => ({
    path: `model-${index}.qnt`,
    traces: traces!,
    maxSteps: maxSteps!,
  }));
  const batches = modelDrawBatches(draws);
  expect(batches).toHaveLength(2);
  expect(batches.flat().sort((a, b) => a.path.localeCompare(b.path))).toEqual(
    [...draws].sort((a, b) => a.path.localeCompare(b.path))
  );
  const cost = (batch: typeof draws) =>
    batch.reduce((sum, draw) => sum + draw.traces * draw.maxSteps, 0);
  expect(
    Math.max(...batches.map((batch) => cost([...batch])))
  ).toBeLessThanOrEqual(cost(draws) / 2 + 128);
});
