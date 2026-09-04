import type { RandomActionsReport } from '@pkgs/sim';

import type { SyncArgs } from '../scenario';
import { expectInSync } from './expect-in-sync';
import { exampleSystem } from './system';

export type WalkThenInSyncOpts = {
  readonly seed: number;
  readonly args?: Partial<SyncArgs>;
  /** Registered pool action names to walk over (default: whole pool). */
  readonly actions?: readonly string[];
  readonly steps?: number;
};

const TIME = { weight: 1, minMs: 1, maxMs: 40 } as const;

/**
 * One seeded walk over a pool slice, then restoreNetwork + assert domain agreement.
 * Slice tests use this where the walk's standing properties are not enough
 * (the sync `staysInSync` property only fires on a quiet fabric).
 */
export async function walkThenInSync(
  opts: WalkThenInSyncOpts
): Promise<RandomActionsReport> {
  await using s = await exampleSystem.run({
    seed: opts.seed,
    ...(opts.args !== undefined ? { args: opts.args } : {}),
  });
  const walk = await s.randomActions({
    ...(opts.actions !== undefined ? { actions: opts.actions } : {}),
    steps: opts.steps ?? 8,
    time: TIME,
  });
  if (walk.violations.length > 0) {
    throw new Error(
      `walk seed=${String(opts.seed)} violated: ${walk.violations.map((v) => v.error).join('; ')}`
    );
  }
  await expectInSync(s);
  return walk;
}
