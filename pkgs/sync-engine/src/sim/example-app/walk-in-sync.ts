import type { Walk } from '@pkgs/dst';

import type { SyncArgs } from '../../../sim/scenario';
import { expectConverged } from './expect-converged';
import { acmeSystem } from './system';

export type WalkThenConvergeOpts = {
  readonly seed: number;
  readonly args?: Partial<SyncArgs>;
  /** Registered pool action names to walk over (default: whole pool). */
  readonly actions?: readonly string[];
  readonly steps?: number;
};

const TIME = { weight: 1, minMs: 1, maxMs: 40 } as const;

/**
 * One seeded walk over a pool slice, then heal + assert domain agreement.
 * Slice tests use this where the walk's standing properties are not enough
 * (the sync `converges` property only fires on a quiet fabric).
 */
export async function walkThenConverge(
  opts: WalkThenConvergeOpts
): Promise<Walk> {
  await using s = await acmeSystem.script({
    seed: opts.seed,
    ...(opts.args !== undefined ? { args: opts.args } : {}),
  });
  const walk = await s.walk({
    ...(opts.actions !== undefined ? { actions: opts.actions } : {}),
    steps: opts.steps ?? 8,
    time: TIME,
  });
  if (walk.violations.length > 0) {
    throw new Error(
      `walk seed=${String(opts.seed)} violated: ${walk.violations.map((v) => v.error).join('; ')}`
    );
  }
  await expectConverged(s);
  return walk;
}
