// @io-wall-ok — reads a package's committed Quint replay plan.
/**
 * A package's Quint replay plan, `tests/quint/replays.json`: for each model
 * it runs, what its tests replay through the product on the pinned seed
 * (`ReplayPlan` in `@pkgs/quint-server-ts/trace-runs`). The spec split sizes a
 * planned model's files and parts by those replays — per variant, per check
 * profile — instead of a fixed count of drawn traces, and the model's run
 * fails when its draw no longer matches the plan. `model-replays.ts --write`
 * refreshes it.
 */

import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { ReplayPlan } from '@pkgs/quint-server-ts/trace-runs';
import type { SpecUnit } from './spec-parts';
import { specUnits } from './spec-parts';

/** Where a package keeps its plan, relative to the package directory. */
export const REPLAY_PLAN_PATH = 'tests/quint/replays.json';

/** Each planned model's replays, by model stem. */
export type ReplayPlans = Readonly<Record<string, ReplayPlan>>;

/** The package's plan, or `null` when it plans no replays. */
export function readReplayPlans(packageDir: string): ReplayPlans | null {
  const path = join(packageDir, REPLAY_PLAN_PATH);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as ReplayPlans;
}

/**
 * The plan for the model at `path`: `undefined` when the package plans no
 * replays, `null` when it plans them but not this model's.
 */
export function replayPlanFor(
  plans: ReplayPlans | null,
  path: string
): ReplayPlan | null | undefined {
  if (plans === null) return undefined;
  return plans[basename(path, '.qnt')] ?? null;
}

/** The test files of a package's `specs` (absolute paths) at `partCount` parts. */
export function packageSpecUnits(
  packageDir: string,
  specs: readonly string[],
  partCount = 1
): readonly SpecUnit[] {
  return preparePackageSpecUnits(packageDir, specs)(partCount);
}

/** Read and weigh once when comparing several possible allocations of one suite. */
export function preparePackageSpecUnits(
  packageDir: string,
  specs: readonly string[]
): (partCount: number) => readonly SpecUnit[] {
  const plans = readReplayPlans(packageDir);
  const readers = specs.map((path) => {
    const source = readFileSync(path, 'utf8');
    const plan = path.endsWith('.qnt') ? replayPlanFor(plans, path) : undefined;
    if (path.endsWith('.qnt') && plan == null)
      return (partCount: number) => specUnits(path, source, partCount, plan);
    const fixed = specUnits(path, source, 1, plan);
    return () => fixed;
  });
  return (partCount) => readers.flatMap((read) => read(partCount));
}
