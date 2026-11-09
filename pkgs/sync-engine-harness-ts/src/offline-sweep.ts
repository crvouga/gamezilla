/**
 * The standard offline-first sweep: two people on their own devices write to
 * shared notes while the seeded adversary of one fault profile strikes
 * between steps. Used by the sweep property, its regressions and evidence.
 */

import fc from 'fast-check';
import type { FaultProfileName } from './fault-profiles';
import { FAULT_PROFILES } from './fault-profiles';
import type { FaultScenario, FaultSweepOutcome } from './fault-sweep';
import { runUnderFaultProfile } from './fault-sweep';
import type { WorkloadStep } from './offline-workload';
import { arbWorkloadStep, performWorkloadStep } from './offline-workload';
import { addClient } from './regression-actions';

/** Two people, one device each, writing to the same shared notes. */
export const DEVICES = ['phone', 'laptop'] as const;
/** Time between a person's steps (the adversary strikes in between). */
const STEP_GAP_MS = 750;

export const arbSteps = fc.array(arbWorkloadStep(DEVICES.length), {
  minLength: 1,
  maxLength: 14,
});

export async function openDevices(s: FaultScenario['s']): Promise<void> {
  await s.apply(addClient, { id: 'phone', actorId: 'alice' });
  await s.apply(addClient, { id: 'laptop', actorId: 'bob' });
}

/** One adversarial run: the workload, with the adversary between steps. */
export async function sweepOnce(
  name: FaultProfileName,
  seed: number,
  steps: readonly WorkloadStep[]
): Promise<FaultSweepOutcome> {
  return runUnderFaultProfile({
    profile: FAULT_PROFILES[name],
    seed,
    body: async ({ s, chaos, ledger }) => {
      await openDevices(s);
      for (const [n, step] of steps.entries()) {
        await chaos();
        await performWorkloadStep(s, DEVICES, step, { n, ledger });
        await s.advanceTime(STEP_GAP_MS);
      }
    },
  });
}
