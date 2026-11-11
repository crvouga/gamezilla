// @io-wall-ok — reads a package's committed Quint replay plan.
/**
 * A package's Quint replay plan, `tests/quint/replays.json`: for each model
 * it runs, what its tests replay through the product on the pinned seed
 * (`ReplayPlan` in `@pkgs/quint-server-ts/trace-runs`). The spec split sizes a
 * planned model's files and parts by those replays — per variant, per check
 * profile — instead of a fixed count of drawn traces, and the model's run
 * fails when its draw no longer matches the plan. `model-replays.ts --write`
 * refreshes it. A model may also record its measured nightly replay cost
 * (`nightlyReplayCost`, see `PlannedModel`), which sizes its nightly files.
 */

import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import type { ReplayPlan } from '@pkgs/quint-server-ts/trace-runs';
import { readFeatureVariants, variantFeatureUnits } from './feature-variants';
import type { PlannedModel, SpecUnit } from './spec-parts';
import { specUnits } from './spec-parts';

/** Where a package keeps its plan, relative to the package directory. */
export const REPLAY_PLAN_PATH = 'tests/quint/replays.json';

/** Each planned model's replays, by model stem. */
export type ReplayPlans = Readonly<Record<string, PlannedModel>>;

/** The package's plan, or `null` when it plans no replays. */
export function readReplayPlans(packageDir: string): ReplayPlans | null {
  const path = join(packageDir, REPLAY_PLAN_PATH);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as ReplayPlans;
}

/**
 * The planned entry for the model at `path`: `undefined` when the package
 * plans no replays, `null` when it plans them but not this model's.
 */
export function plannedModelFor(
  plans: ReplayPlans | null,
  path: string
): PlannedModel | null | undefined {
  if (plans === null) return undefined;
  return plans[basename(path, '.qnt')] ?? null;
}

/**
 * The plan the model's run checks its draw against: its planned entry
 * without the measured cost, which no draw produces.
 */
export function replayPlanFor(
  plans: ReplayPlans | null,
  path: string
): ReplayPlan | null | undefined {
  const planned = plannedModelFor(plans, path);
  if (planned === null || planned === undefined) return planned;
  const { nightlyReplayCost: _cost, ...plan } = planned;
  return plan;
}

/** The test files of a package's `specs` (absolute paths) at `partCount` parts. */
export function packageSpecUnits(
  packageDir: string,
  specs: readonly string[],
  partCount = 1
): readonly SpecUnit[] {
  return packageSpecInventory(packageDir, specs)(partCount);
}

/** Snapshot sources and planned replay units once for independent candidate splits. */
export function packageSpecInventory(
  packageDir: string,
  specs: readonly string[]
): (partCount?: number) => readonly SpecUnit[] {
  const plans = readReplayPlans(packageDir);
  const variants = readFeatureVariants(packageDir);
  const inventories = specs.map((path) => {
    const source = readFileSync(path, 'utf8');
    if (path.endsWith('.feature') && variants !== null) {
      const units = variantFeatureUnits(path, source, variants);
      return () => units;
    }
    const plan = path.endsWith('.qnt')
      ? plannedModelFor(plans, path)
      : undefined;
    // An unplanned model's slice count depends on the candidate part count.
    if (path.endsWith('.qnt') && plan == null)
      return (count: number) => specUnits(path, source, count, plan);
    const units = specUnits(path, source, 1, plan);
    return () => units;
  });
  return (partCount = 1) =>
    inventories.flatMap((inventory) => inventory(partCount));
}
