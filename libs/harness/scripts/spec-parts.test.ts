import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReplayPlan } from '@pkgs/quint-server/trace-runs';
import { sliceReplays } from '@pkgs/quint-server/trace-runs';
import { packageSpecUnits, readReplayPlans } from './replay-plans';
import type { SpecUnit } from './spec-parts';
import {
  CHECK_WEIGHT,
  MODEL_FILE_REPLAYS,
  MODEL_SLICES,
  MODEL_WEIGHT,
  modelDrawBatches,
  NIGHTLY_REPLAY_SCALE,
  PART_LOAD,
  PART_REPLAYS,
  partLoad,
  partOf,
  plannedModelUnits,
  SLICE_SCENARIOS,
  specUnits,
  specWeight,
  TRACE_WEIGHT,
} from './spec-parts';
import { packageSpecs } from './spec-sources';

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

describe('a planned model', () => {
  // Three games; traces 1 and 4 of ten take every bound action; two pinned
  // histories; a determinism check replaying its trace twice.
  const plan: ReplayPlan = {
    seed: '0x2a',
    traces: 10,
    cover: [1, 4],
    replayed: [1, 4],
    regressions: 2,
    determinism: true,
    variants: 3,
  };
  const sum = (units: readonly SpecUnit[], profile: 'pr' | 'nightly') =>
    units.reduce((total, unit) => total + unit.replays![profile], 0);

  test('counts the replays the gate runs for every variant, not the draw', () => {
    // Per game: the two covering traces, the two histories, the check twice.
    expect(sliceReplays(plan, 'pr', { index: 0, count: 1 })).toBe(3 * 6);
    // Nightly adds the eight other traces, each for one game in turn.
    expect(sliceReplays(plan, 'nightly', { index: 0, count: 1 })).toBe(
      3 * 6 + 8
    );
  });

  test('spreads them over the fewest files of at most MODEL_FILE_REPLAYS', () => {
    const units = plannedModelUnits('specs/g/m.qnt', plan);
    expect(sum(units, 'pr')).toBe(18);
    expect(sum(units, 'nightly')).toBe(26);
    expect(units.every((unit) => unit.replays!.pr <= MODEL_FILE_REPLAYS)).toBe(
      true
    );
    const fewer = units.length - 1;
    expect(
      Array.from({ length: fewer }, (_, index) =>
        sliceReplays(plan, 'pr', { index, count: fewer })
      ).some((replays) => replays > MODEL_FILE_REPLAYS)
    ).toBe(true);
    for (const unit of units)
      expect(unit.weight).toBe(
        TRACE_WEIGHT *
          Math.max(
            unit.replays!.pr,
            unit.replays!.nightly / NIGHTLY_REPLAY_SCALE
          )
      );
  });

  test('a package that plans replays sizes its models by them', () => {
    expect(specUnits('specs/g/m.qnt', '', 64, plan)).toEqual(
      plannedModelUnits('specs/g/m.qnt', plan)
    );
    // Unplanned, a model stays the fixed draw it always was.
    expect(specUnits('specs/g/m.qnt', '', 1, null)).toEqual(
      specUnits('specs/g/m.qnt', '', 1)
    );
  });

  test('a part counts a gate replay as TRACE_WEIGHT scenario units', () => {
    const units = plannedModelUnits('specs/g/m.qnt', plan);
    expect(partLoad([...units, { path: 'a.feature', weight: 5 }])).toEqual({
      load: 5 + TRACE_WEIGHT * 18,
      pr: 18,
      nightly: 26,
    });
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
   * The suites that plan their models' replays (`tests/quint/replays.json`):
   * every replay of every model runs in exactly one file, a file holds at
   * most MODEL_FILE_REPLAYS gate replays, and a part at most PART_REPLAYS of
   * them (NIGHTLY_REPLAY_SCALE times as many nightly) and PART_LOAD scenario
   * units. Each suite runs in the fewest parts those caps allow. The shared
   * games suite replays every model once per game it holds for, so its
   * replays are counted per game.
   */
  const PLANNED_SUITES = [
    'libs/chess-root-harness',
    'libs/games-harness',
  ] as const;

  test.each(PLANNED_SUITES)(
    '%s keeps every part inside its replay and load caps',
    (dir) => {
      // regression: chess-spec-trace-batches — 32 parts put 20 traces in one task.
      // regression: chess-spec-slice-weight
      // regression: network-model-overfills-chess-shard
      const { plans, specParts } = plannedSuite(dir);
      const parts = suiteParts(dir, specParts);
      const models = Object.keys(plans);
      expect(models.length).toBeGreaterThan(0);
      for (const model of models) {
        const files = parts
          .flat()
          .filter((unit) => unit.path.endsWith(`/${model}.qnt`));
        for (const profile of ['pr', 'nightly'] as const)
          expect(
            files.reduce((sum, unit) => sum + unit.replays![profile], 0)
          ).toBe(sliceReplays(plans[model]!, profile, { index: 0, count: 1 }));
      }
      for (const part of parts) expect(withinCaps(part)).toBe(true);
    }
  );

  test.each(PLANNED_SUITES)(
    '%s runs in the fewest parts its caps allow',
    (dir) => {
      const { specParts } = plannedSuite(dir);
      for (let count = 1; count < specParts; count++)
        expect(suiteParts(dir, count).every(withinCaps)).toBe(false);
    }
  );
});

/** Whether a part of a planned suite stays inside every cap. */
function withinCaps(part: readonly SpecUnit[]): boolean {
  const load = partLoad(part);
  return (
    load.pr <= PART_REPLAYS &&
    load.nightly <= PART_REPLAYS * NIGHTLY_REPLAY_SCALE &&
    load.load <= PART_LOAD &&
    part.every((unit) => (unit.replays?.pr ?? 0) <= MODEL_FILE_REPLAYS)
  );
}

const REPO_ROOT = join(import.meta.dir, '../../..');

function plannedSuite(dir: string) {
  const plans = readReplayPlans(join(REPO_ROOT, dir));
  if (plans === null) throw new Error(`${dir} plans no replays`);
  const manifest = JSON.parse(
    readFileSync(join(REPO_ROOT, dir, 'package.json'), 'utf8')
  ) as { specParts: number };
  return { plans, specParts: manifest.specParts };
}

/** A package's assignment at `count` parts, as its spec runner computes it. */
function suiteParts(
  dir: string,
  count: number
): readonly (readonly SpecUnit[])[] {
  const packageDir = join(REPO_ROOT, dir);
  const units = packageSpecUnits(
    packageDir,
    packageSpecs(packageDir, REPO_ROOT),
    count
  );
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
