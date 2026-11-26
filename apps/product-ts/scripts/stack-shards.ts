/**
 * How the browser suite (`test:stack`) divides into partitions, one
 * runner's work each. A partition is a list of `test:spec` processes, a
 * light package whole or a heavy one as `--part k/n` parts. A part is the
 * split `test-spec.ts` itself computes (`partsOf` over the package's spec
 * units), so the plan never names an empty part and, over every partition,
 * every spec unit runs exactly once. The plan reads only the specs and the
 * rates below, never the machine, so every runner computes the same plan.
 *
 * Packages run one after another on a runner, and a unit (one test file)
 * runs its scenarios in order on one worker, so a part costs its longest
 * unit or its whole load spread over the runner's workers, whichever is
 * more. Parts are placed longest first onto the least loaded partition, in
 * as few partitions as hold {@link SHARD_SECONDS} each.
 *
 * The whole suite is far more than one night's runners hold, so Verify
 * Nightly runs a few partitions a night ({@link rotatedPartition}) and the
 * whole suite over successive nights.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { packageSpecInventory } from '@libs/harness-ts/replay-plans';
import type { Part, SpecUnit } from '@libs/harness-ts/spec-parts';
import { partsOf } from '@libs/harness-ts/spec-parts';
import {
  packageSpecManifest,
  packageSpecs,
  specWorkers,
} from '@libs/harness-ts/spec-sources';
import type { NightlyShard } from './nightly-shard';

/** One `test:spec` process on a shard's stack. */
export type StackRun = {
  /** Repo-relative package directory. */
  readonly dir: string;
  /** `--part k/n` (0-based), or `null` for the package's whole suite. */
  readonly part: Part | null;
  /** Expected wall seconds on a hosted runner. */
  readonly seconds: number;
};

/** What the plan knows of one spec package. */
export type StackPackage = {
  readonly dir: string;
  /** Spec workers one of its `test:spec` processes runs on a stack runner. */
  readonly workers: number;
  /** Stack seconds one unit of spec weight costs. */
  readonly secondsPerWeight: number;
  /** The package's parts when its suite is split `count` ways (`partsOf`). */
  readonly partsAt: (count: number) => readonly (readonly SpecUnit[])[];
  /** Whether it has `tests/harness` code tests, which part 0 runs. */
  readonly codeTests: boolean;
};

export type StackPlan = {
  readonly shards: readonly (readonly StackRun[])[];
  /** Expected seconds of each partition, in partition order. */
  readonly loads: readonly number[];
};

/**
 * Spec workers on a stack runner: the hosted runner's 4 CPUs less the two
 * `specWorkerCeiling` keeps for the stack and the OS. Fixed here, not read
 * from the machine, so every runner plans alike.
 */
export const STACK_WORKERS = 2;
/** Starting one `test:spec` process: stubs, preloads, the first world. */
export const RUN_OVERHEAD_SECONDS = 30;
/**
 * The expected work a partition is sized for, and the most one part may
 * hold: 24 minutes, so checkout, setup and the stack's boot keep a runner
 * near half an hour.
 */
export const SHARD_SECONDS = 1440;
/**
 * A package no night has measured yet is rated as a multi-player game
 * suite, so it is split rather than under-planned.
 */
export const UNMEASURED_SECONDS_PER_WEIGHT = 120;

/**
 * Stack seconds per unit of spec weight, measured on the hosted runner: a
 * package's summed scenario times over its spec weight (Verify Nightly runs
 * 45374726964 and 45595122814). Packages those runs stopped at their first
 * failure are rated by their passing scenarios. A night's
 * `apps/product-ts/.cache/stack-shard/` records each run's estimate beside
 * its measured seconds, the evidence to update these by.
 */
export const STACK_SECONDS_PER_WEIGHT: Readonly<Record<string, number>> = {
  'apps/product-ts': 60,
  'libs/battleship-harness-ts': 75,
  'libs/billing-harness-ts': 30,
  'libs/chess-root-harness-ts': 40,
  'libs/connect-four-harness-ts': 235,
  'libs/friends-harness-ts': 50,
  'libs/game-puzzle-harness-ts': 1.5,
  'libs/games-harness-ts': 61,
  'libs/hearts-harness-ts': 120,
  'libs/light-cycles-harness-ts': 45,
  'libs/numberlink-harness-ts': 0.5,
  'libs/observatory-harness-ts': 11,
  'libs/pong-harness-ts': 15,
  'libs/profile-harness-ts': 18,
  'libs/quoridor-harness-ts': 110,
  'libs/runtime-harness-ts': 22,
  'libs/sokoban-harness-ts': 0.5,
  'libs/synthetic-population-harness-ts': 7,
  'libs/word-tiles-harness-ts': 0.5,
  'pkgs/auth-root-harness-ts': 0.5,
  'pkgs/chess-board-root-harness-ts': 1,
  'pkgs/db-indexes-root-harness-ts': 0.5,
  'pkgs/feedback-harness-ts': 0.5,
  'pkgs/matchmaking-root-harness-ts': 0.6,
  'pkgs/room-root-harness-ts': 0.5,
  'pkgs/sync-engine-harness-ts': 2.6,
};

/** The spec packages in `dirs` (repo-relative), as the plan sees them. */
export function readStackPackages(
  repoRoot: string,
  dirs: readonly string[]
): readonly StackPackage[] {
  return dirs.map((dir) => {
    const packageDir = join(repoRoot, dir);
    // The inventory `test-spec.ts --part` splits, read the same way.
    const inventory = packageSpecInventory(
      packageDir,
      packageSpecs(packageDir, repoRoot)
    );
    return {
      dir,
      workers: specWorkers(
        { HARNESS_MODE: 'stack' },
        packageSpecManifest(packageDir),
        STACK_WORKERS
      ),
      secondsPerWeight:
        STACK_SECONDS_PER_WEIGHT[dir] ?? UNMEASURED_SECONDS_PER_WEIGHT,
      partsAt: (count) => partsOf(inventory(count), count),
      codeTests: existsSync(join(packageDir, 'tests/harness')),
    };
  });
}

function weightOf(units: readonly SpecUnit[]): number {
  return units.reduce((sum, unit) => sum + unit.weight, 0);
}

function partSeconds(pkg: StackPackage, units: readonly SpecUnit[]): number {
  const longest = Math.max(0, ...units.map((unit) => unit.weight));
  const work = Math.max(longest, weightOf(units) / pkg.workers);
  return Math.ceil(RUN_OVERHEAD_SECONDS + work * pkg.secondsPerWeight);
}

function runsAt(pkg: StackPackage, count: number): readonly StackRun[] {
  if (count === 1) {
    const units = pkg.partsAt(1)[0] ?? [];
    return [{ dir: pkg.dir, part: null, seconds: partSeconds(pkg, units) }];
  }
  return pkg.partsAt(count).flatMap((units, index) => {
    // `test-spec.ts` refuses an empty part; part 0 always has the code tests.
    if (units.length === 0 && !(index === 0 && pkg.codeTests)) return [];
    const part = { index, count };
    return [{ dir: pkg.dir, part, seconds: partSeconds(pkg, units) }];
  });
}

function longestRun(runs: readonly StackRun[]): number {
  return Math.max(0, ...runs.map((run) => run.seconds));
}

/**
 * The fewest parts whose longest fits {@link SHARD_SECONDS}; when a unit
 * alone outgrows it, the split with the shortest longest part.
 */
export function packageRuns(pkg: StackPackage): readonly StackRun[] {
  const whole = pkg.partsAt(1)[0] ?? [];
  const units = Math.max(1, whole.length);
  const work = partSeconds(pkg, whole) - RUN_OVERHEAD_SECONDS;
  let best = runsAt(pkg, 1);
  let count = Math.min(units, Math.max(2, Math.ceil(work / SHARD_SECONDS)));
  for (; longestRun(best) > SHARD_SECONDS && count <= units; count++) {
    const runs = runsAt(pkg, count);
    if (longestRun(runs) < longestRun(best)) best = runs;
  }
  return best;
}

function byCost(a: StackRun, b: StackRun): number {
  return (
    b.seconds - a.seconds ||
    a.dir.localeCompare(b.dir, 'en') ||
    (a.part?.index ?? 0) - (b.part?.index ?? 0)
  );
}

/** Every package's runs, longest first. */
export function stackRuns(
  packages: readonly StackPackage[]
): readonly StackRun[] {
  return packages.flatMap(packageRuns).sort(byCost);
}

/** `runs`, longest first onto the least loaded of `count` partitions. */
export function planStackShards(
  runs: readonly StackRun[],
  count: number
): StackPlan {
  if (!Number.isSafeInteger(count) || count < 1)
    throw new Error('A stack plan needs at least one partition');
  const shards: StackRun[][] = Array.from({ length: count }, () => []);
  const loads = shards.map(() => 0);
  for (const run of [...runs].sort(byCost)) {
    const lightest = loads.indexOf(Math.min(...loads));
    shards[lightest]!.push(run);
    loads[lightest]! += run.seconds;
  }
  return { shards, loads };
}

/**
 * The fewest partitions whose fullest holds at most {@link SHARD_SECONDS};
 * a run alone above it gets a partition of its own.
 */
export function partitionCount(runs: readonly StackRun[]): number {
  const total = runs.reduce((sum, run) => sum + run.seconds, 0);
  let count = Math.max(
    1,
    Math.min(runs.length, Math.ceil(total / SHARD_SECONDS))
  );
  while (
    count < runs.length &&
    Math.max(...planStackShards(runs, count).loads) > SHARD_SECONDS
  )
    count++;
  return count;
}

/**
 * The partition (0-based) a nightly runner holds: on UTC day `night`, the
 * `slot.count` runners take the next `slot.count` partitions in turn, so
 * every partition runs once in `ceil(partitions / slot.count)` nights.
 * `null` when there are more runners than partitions.
 */
export function rotatedPartition(
  slot: { readonly index: number; readonly count: number },
  night: number,
  partitions: number
): number | null {
  if (slot.index >= partitions) return null;
  return (night * slot.count + slot.index) % partitions;
}

/** What one browser runner verifies. */
export type PartitionChoice =
  | { readonly kind: 'whole' }
  | { readonly kind: 'idle' }
  | {
      readonly kind: 'partition';
      /** 0-based. */
      readonly index: number;
      /** The UTC day that chose it, or `null` when a person named it. */
      readonly night: number | null;
    };

/**
 * A named partition (`BROWSER_PARTITION`, 1-based) is a diagnostic of that
 * one; a runner of the nightly matrix (`NIGHTLY_SHARD`) takes its turn on
 * the run's UTC day (`NIGHTLY_NIGHT`), and refuses to guess one it was not
 * given; with neither, the whole suite runs, as `bun verify-nightly browser`.
 */
export function choosePartition(
  input: {
    readonly slot: NightlyShard;
    readonly night: string | undefined;
    readonly partition: string | undefined;
  },
  partitions: number
): PartitionChoice {
  const named = input.partition?.trim() ?? '';
  if (named !== '') {
    const index = Number(named) - 1;
    if (!(Number.isSafeInteger(index) && index >= 0 && index < partitions))
      throw new Error(
        `BROWSER_PARTITION=${named} is not one of the ${String(partitions)} browser partitions`
      );
    return { kind: 'partition', index, night: null };
  }
  const day = input.night?.trim() ?? '';
  if (day === '' && input.slot.count === 1) return { kind: 'whole' };
  const night = Number(day);
  if (day === '' || !Number.isSafeInteger(night) || night < 0)
    throw new Error(
      `A nightly browser runner needs NIGHTLY_NIGHT, the run's UTC day, to take its turn; got "${day}"`
    );
  const index = rotatedPartition(input.slot, night, partitions);
  return index === null
    ? { kind: 'idle' }
    : { kind: 'partition', index, night };
}

/** The `test:spec` arguments of one run. */
export function runArgs(run: StackRun): readonly string[] {
  return run.part === null
    ? []
    : ['--part', `${String(run.part.index)}/${String(run.part.count)}`];
}
