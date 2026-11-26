import { describe, expect, test } from 'bun:test';
import type { SpecUnit } from '@libs/harness-ts/spec-parts';
import { partsOf } from '@libs/harness-ts/spec-parts';
import type { StackPackage, StackRun } from './stack-shards';
import {
  choosePartition,
  packageRuns,
  partitionCount,
  planStackShards,
  RUN_OVERHEAD_SECONDS,
  rotatedPartition,
  runArgs,
  SHARD_SECONDS,
  STACK_WORKERS,
  stackRuns,
} from './stack-shards';

function features(domain: string, weights: readonly number[]): SpecUnit[] {
  return weights.map((weight, index) => ({
    path: `/repo/specs/${domain}/feature-${String(index)}.feature`,
    weight,
  }));
}

function spec(
  dir: string,
  units: readonly SpecUnit[],
  secondsPerWeight: number,
  extra: Partial<StackPackage> = {}
): StackPackage {
  return {
    dir,
    workers: STACK_WORKERS,
    secondsPerWeight,
    partsAt: (count) => partsOf(units, count),
    codeTests: false,
    ...extra,
  };
}

/** The spec units each run of `runs` executes, as `test-spec.ts` selects them. */
function unitsRun(
  packages: readonly StackPackage[],
  runs: readonly StackRun[]
): string[] {
  return runs.flatMap((run) => {
    const pkg = packages.find((candidate) => candidate.dir === run.dir)!;
    const units =
      run.part === null
        ? pkg.partsAt(1)[0]!
        : pkg.partsAt(run.part.count)[run.part.index]!;
    return units.map((unit) => `${run.dir}:${unit.path}`);
  });
}

const light = spec('pkgs/light', features('light', [6, 6, 4]), 0.5);
const heavy = spec(
  'libs/heavy',
  features(
    'heavy',
    Array.from({ length: 60 }, (_, index) => 2 + (index % 5))
  ),
  60
);
const serial = spec('libs/serial', features('serial', [6, 6, 6, 6]), 20, {
  workers: 1,
});
const PACKAGES = [light, heavy, serial];

describe('the browser partitions', () => {
  test('a light suite runs whole on one runner', () => {
    expect(packageRuns(light)).toEqual([
      // 16 weight over two workers, at half a second each.
      { dir: 'pkgs/light', part: null, seconds: RUN_OVERHEAD_SECONDS + 4 },
    ]);
    expect(runArgs(packageRuns(light)[0]!)).toEqual([]);
  });

  test('a heavy suite splits into the parts test-spec runs, each within a shard', () => {
    const runs = packageRuns(heavy);
    expect(runs.length).toBeGreaterThan(1);
    for (const run of runs) {
      expect(run.seconds).toBeLessThanOrEqual(SHARD_SECONDS);
      expect(runArgs(run)).toEqual([
        '--part',
        `${String(run.part!.index)}/${String(run.part!.count)}`,
      ]);
    }
  });

  test('over every partition each spec unit runs exactly once, and no run is empty', () => {
    const plan = planStackShards(stackRuns(PACKAGES), 7);
    const runs = plan.shards.flat();
    for (const run of runs)
      expect(unitsRun(PACKAGES, [run]).length, run.dir).toBeGreaterThan(0);
    const expected = PACKAGES.flatMap((pkg) =>
      pkg.partsAt(1)[0]!.map((unit) => `${pkg.dir}:${unit.path}`)
    );
    expect(unitsRun(PACKAGES, runs).toSorted()).toEqual(expected.toSorted());
  });

  test('part 0 keeps the code tests even when it holds no spec', () => {
    const units = features('coded', [6, 6, 6]);
    const coded = spec('libs/coded', units, 300, {
      // Every spec lands past part 0, which `test-spec.ts` still gives the
      // package's `tests/harness`.
      partsAt: (count) =>
        Array.from({ length: count }, (_, part) =>
          count === 1
            ? units
            : units.filter((_, index) => index % (count - 1) === part - 1)
        ),
      codeTests: true,
    });
    expect(packageRuns(coded).map((run) => run.part?.index)).toContain(0);
    const uncoded = { ...coded, codeTests: false };
    expect(packageRuns(uncoded).map((run) => run.part?.index)).not.toContain(0);
  });

  test('a unit runs its scenarios in order, so it bounds its part', () => {
    // A stack-serial suite has one worker for its 24 weight.
    expect(packageRuns(serial)).toEqual([
      { dir: 'libs/serial', part: null, seconds: RUN_OVERHEAD_SECONDS + 480 },
    ]);
    // One long feature is one file: no split runs it faster.
    const single = spec('libs/single', features('single', [40]), 60);
    expect(packageRuns(single)).toEqual([
      { dir: 'libs/single', part: null, seconds: RUN_OVERHEAD_SECONDS + 2400 },
    ]);
  });

  test('every runner computes the same plan, longest first onto the lightest partition', () => {
    const runs = stackRuns(PACKAGES);
    const plan = planStackShards(runs, 7);
    expect(planStackShards(stackRuns(PACKAGES), 7)).toEqual(plan);
    const longest = Math.max(...runs.map((run) => run.seconds));
    const mean = plan.loads.reduce((sum, load) => sum + load, 0) / 7;
    for (const [index, shard] of plan.shards.entries()) {
      expect(plan.loads[index]).toBe(
        shard.reduce((sum, run) => sum + run.seconds, 0)
      );
      expect(plan.loads[index]!).toBeLessThanOrEqual(mean + longest);
    }
    expect(() => planStackShards(runs, 0)).toThrow('at least one partition');
  });

  // regression: nightly-browser-suite-outgrows-one-runner
  test('the suite takes the fewest partitions that each fit a runner', () => {
    const runs = stackRuns(PACKAGES);
    const count = partitionCount(runs);
    const fullest = (n: number) => Math.max(...planStackShards(runs, n).loads);
    expect(fullest(count)).toBeLessThanOrEqual(SHARD_SECONDS);
    expect(fullest(count - 1)).toBeGreaterThan(SHARD_SECONDS);
    // A run no split can shorten gets a partition of its own.
    const single = stackRuns([
      spec('libs/single', features('single', [40]), 60),
    ]);
    expect(partitionCount(single)).toBe(1);
  });
});

describe('the nightly rotation', () => {
  test('a night runs a few partitions, and successive nights run them all', () => {
    const partitions = 10;
    const runners = 4;
    const nights = Math.ceil(partitions / runners);
    const seen: number[] = [];
    for (let night = 100; night < 100 + nights; night++) {
      const tonight = Array.from({ length: runners }, (_, index) =>
        rotatedPartition({ index, count: runners }, night, partitions)
      );
      expect(new Set(tonight).size).toBe(runners);
      seen.push(...tonight.map(Number));
    }
    expect(new Set(seen).size).toBe(partitions);
    // More runners than partitions: the extra one has nothing to run.
    expect(rotatedPartition({ index: 3, count: 4 }, 0, 3)).toBeNull();
  });

  test('a named partition is a diagnostic; a nightly runner never guesses its night', () => {
    const slot = { index: 1, count: 4 };
    expect(
      choosePartition({ slot, night: '7', partition: undefined }, 50)
    ).toEqual({ kind: 'partition', index: 29, night: 7 });
    expect(choosePartition({ slot, night: '7', partition: '12' }, 50)).toEqual({
      kind: 'partition',
      index: 11,
      night: null,
    });
    for (const bad of ['0', '51', 'two'])
      expect(() =>
        choosePartition({ slot, night: '7', partition: bad }, 50)
      ).toThrow('is not one of the 50 browser partitions');
    for (const night of [undefined, '', 'today'])
      expect(() => choosePartition({ slot, night, partition: '' }, 50)).toThrow(
        'needs NIGHTLY_NIGHT'
      );
    expect(
      choosePartition(
        { slot: { index: 0, count: 1 }, night: undefined, partition: '' },
        50
      )
    ).toEqual({ kind: 'whole' });
  });
});
