import { expect, test } from 'bun:test';
import { FAULT_PROFILES } from '@pkgs/sync-engine-harness-ts/fault-profiles';
import { runUnderFaultProfile } from '@pkgs/sync-engine-harness-ts/fault-sweep';
import type { VerdictCorruption } from '@pkgs/sync-engine-harness-ts/hostile-responses';
import { VERDICT_CORRUPTIONS } from '@pkgs/sync-engine-harness-ts/hostile-responses';
import type { WorkloadStep } from '@pkgs/sync-engine-harness-ts/offline-workload';
import { performWorkloadStep } from '@pkgs/sync-engine-harness-ts/offline-workload';
import { online } from '@pkgs/sync-engine-harness-ts/regression-actions';
import { httpFault } from '@pkgs/sync-engine-harness-ts/regression-random-faults-actions';
import { DEVICES, openDevices, sweepOnce } from '@pkgs/sync-engine-harness-ts/offline-sweep';

// regression: malformed-verdict-misread-as-outcome
test('a garbled "rejected" verdict does not mark a saved write as refused', async () => {
  const steps: WorkloadStep[] = [
    { kind: 'append', device: 0, note: 2 },
    { kind: 'append', device: 0, note: 0 },
    { kind: 'wait', ms: 3686 },
    { kind: 'append', device: 0, note: 1 },
    { kind: 'append', device: 0, note: 2 },
    { kind: 'append', device: 0, note: 0 },
    { kind: 'append', device: 0, note: 1 },
    { kind: 'wait', ms: 10102 },
    { kind: 'append', device: 0, note: 1 },
    { kind: 'append', device: 1, note: 0 },
    { kind: 'wait', ms: 10852 },
  ];
  const outcome = await sweepOnce('corrupt', 1, steps);
  expect(outcome.violations).toEqual([]);
});

// regression: malformed-verdict-misread-as-outcome
test('a refusal garbled into an unknown status still reaches the device', async () => {
  const steps: WorkloadStep[] = [
    { kind: 'append', device: 0, note: 1 },
    { kind: 'append', device: 1, note: 1 },
    { kind: 'append', device: 1, note: 1 },
    { kind: 'wait', ms: 4 },
    { kind: 'wait', ms: 19491 },
    { kind: 'refused', device: 0 },
    { kind: 'refused', device: 0 },
    { kind: 'append', device: 0, note: 0 },
    { kind: 'refused', device: 0 },
    { kind: 'append', device: 0, note: 2 },
    { kind: 'refused', device: 1 },
  ];
  const outcome = await sweepOnce('corrupt', 48, steps);
  expect(outcome.violations).toEqual([]);
});

async function oneGarbledReply(variant: VerdictCorruption) {
  return runUnderFaultProfile({
    profile: FAULT_PROFILES.reliable,
    seed: 7,
    body: async ({ s, ledger }) => {
      await openDevices(s);
      await s.apply(httpFault, 'phone', { kind: 'corruptVerdicts', variant });
      // Queue both writes offline so one reply carries both verdicts.
      await s.apply(online, 'phone', false);
      const steps: WorkloadStep[] = [
        { kind: 'append', device: 0, note: 0 },
        { kind: 'refused', device: 0 },
      ];
      for (const [n, step] of steps.entries()) {
        await performWorkloadStep(s, DEVICES, step, { n, ledger });
      }
      await s.apply(online, 'phone', true);
      await s.advanceTime(5_000);
    },
  });
}

test.each([...VERDICT_CORRUPTIONS])(
  'a reply with %s verdicts is retried until the device hears the real outcome',
  async (variant) => {
    const outcome = await oneGarbledReply(variant);
    expect(outcome.writes).toBe(2);
    expect(outcome.violations).toEqual([]);
  }
);
