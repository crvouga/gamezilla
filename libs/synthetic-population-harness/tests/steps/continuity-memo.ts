import type { HarnessWorld } from '@libs/harness/spec-world';
import { recall, remember } from '@libs/harness/spec-world';
import { syntheticContinuity } from '@libs/synthetic-population-harness/continuity-actions';

export type Continuity = Awaited<ReturnType<typeof syntheticContinuity>>;

const CONTINUITY = 'synthetic-population:continuity';

/** Remember the Synthetic User's account and game as they are now. */
export async function rememberContinuity(w: HarnessWorld): Promise<Continuity> {
  return remember(w, CONTINUITY, await w.s.read(syntheticContinuity));
}

/** The account and game an earlier step remembered. */
export function recallContinuity(w: HarnessWorld): Continuity {
  return recall(w, CONTINUITY) as Continuity;
}
