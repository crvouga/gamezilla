/**
 * Runs the crash script once per durable boundary and moment, each on a
 * fresh run, and judges every outcome. Shared by the gate test and the
 * evidence report so both see the same sweep.
 */

import {
  armDurableCrash,
  durableBoundaries,
  trackDurableBoundaries,
} from './durable-crash-actions';
import type { CrashMoment, DurableBoundary } from './durable-crash-points';
import { ALICE, runDurableCrashScript } from './durable-crash-script';
import {
  type CrashVerdict,
  restartAndSettle,
  workLostOrDoubled,
} from './durable-crash-verdict';
import { exampleSystem } from './example-app-system';

export const CRASH_MOMENTS: readonly CrashMoment[] = [
  'beforeCommit',
  'afterCommit',
];

/** The durable step of the client sync path a boundary belongs to. */
export type DurableStep =
  | 'local schema reconcile, migration or cache wipe'
  | 'write applied + queued for upload'
  | 'upload acknowledged + retired'
  | 'snapshot merged + pending writes rebased'
  | 'pushed row applied'
  | 'push checkpoint'
  | 'scope bookkeeping'
  | 'other';

export function durableStep(boundary: DurableBoundary): DurableStep {
  const w = boundary.writes;
  const has = (re: RegExp) => w.some((label) => re.test(label));
  if (has(/^(create|drop|alter|pragma) /)) {
    return 'local schema reconcile, migration or cache wipe';
  }
  if (has(/^insert sync_engine_mutations$/)) {
    return 'write applied + queued for upload';
  }
  if (has(/ sync_engine_mutations$/)) return 'upload acknowledged + retired';
  if (has(/ sync_engine_scope_meta$/) && has(/ notes$/)) {
    return 'snapshot merged + pending writes rebased';
  }
  if (has(/ notes$/)) return 'pushed row applied';
  if (has(/ sync_engine_push_applied$/)) return 'push checkpoint';
  if (has(/ sync_engine_scope_meta$/)) return 'scope bookkeeping';
  return 'other';
}

/** Every boundary the script crosses when nothing crashes. */
export async function recordDurableBoundaries(
  seed: number
): Promise<DurableBoundary[]> {
  await using s = await exampleSystem.run({ seed, args: { clientCount: 0 } });
  await s.apply(trackDurableBoundaries, ALICE);
  await runDurableCrashScript(s);
  return s.read(durableBoundaries, ALICE);
}

export type CrashPointResult = {
  readonly at: number;
  readonly when: CrashMoment;
  readonly verdict: CrashVerdict | null;
  readonly violations: readonly string[];
};

/** Kill alice at boundary `at` (`when`), reopen, sync, judge. */
export async function runCrashPoint(
  seed: number,
  at: number,
  when: CrashMoment
): Promise<CrashPointResult> {
  await using s = await exampleSystem.run({ seed, args: { clientCount: 0 } });
  await s.apply(armDurableCrash, ALICE, at, when);
  try {
    const end = await runDurableCrashScript(s);
    const verdict = await restartAndSettle(s, end);
    return { at, when, verdict, violations: workLostOrDoubled(verdict) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { at, when, verdict: null, violations: [`threw: ${message}`] };
  }
}
