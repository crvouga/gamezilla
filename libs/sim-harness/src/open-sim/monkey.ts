/**
 * A subsystem's monkey: a seeded random walk over the platform's steps (spawn
 * an actor, sign in, partition and restore the network, resize the API fleet,
 * navigate) and the suite's own feature walks, with every standing property
 * of the system checked after each step. Each e2e suite runs one over its own
 * composition; the whole-app suite runs one over everything.
 */

import type { CatalogAction, RandomActionsReport, Run } from '@pkgs/sim';

import { PRODUCT_POOL_ACTIONS } from '../system/pool-actions';
import type { ProductSim } from '../system/sim';
import { walkStepsTaken } from '../system/walk-action';

export type MonkeyOptions = {
  /** The suite's feature walks (`walkAction`s), drawn beside the platform's. */
  readonly walks: readonly CatalogAction<ProductSim>[];
  readonly steps?: number;
};

const DEFAULT_STEPS = 24;

function describeWalk(walk: RandomActionsReport): string {
  return walk.steps
    .map(
      (step, i) =>
        `  ${String(i + 1)}. ${step.action} ${JSON.stringify(step.args)}`
    )
    .join('\n');
}

/**
 * Walk and fail loudly: a violation throws with the step trace, so the walk
 * can be replayed (`system.replay`) from the report or the log.
 */
export async function runMonkey(
  s: Run<ProductSim>,
  options: MonkeyOptions
): Promise<RandomActionsReport> {
  const walk = await s.randomActions({
    actions: [...PRODUCT_POOL_ACTIONS, ...options.walks],
    steps: options.steps ?? DEFAULT_STEPS,
    time: { weight: 1, minMs: 0, maxMs: 2_000 },
  });
  if (walk.violations.length > 0) {
    throw new Error(
      `monkey: ${walk.violations.map((v) => v.error).join('; ')}\nwalk:\n${describeWalk(walk)}`
    );
  }
  // Drawn is not taken: a step whose screen did not allow it did nothing. A
  // walk that never took one of the suite's own steps proved nothing about
  // the suite's feature, so it fails rather than passing vacuously.
  const taken = await s.read(walkStepsTaken);
  const featureSteps = options.walks.reduce(
    (n, action) => n + (taken[action.name] ?? 0),
    0
  );
  if (featureSteps === 0) {
    throw new Error(
      `monkey: the walk never took one of the suite's own steps\nwalk:\n${describeWalk(walk)}`
    );
  }
  return walk;
}
