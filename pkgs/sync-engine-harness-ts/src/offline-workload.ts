/**
 * What people do on their devices while the network misbehaves: append to
 * shared notes, make a change the server will refuse, or put the phone down
 * for a while. Each accepted write joins the ledger the invariants check.
 */

import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import { createSeededRng } from '@pkgs/uuid-shared-ts/seeded-rng';
import fc from 'fast-check';
import { mutate } from './regression-actions';
import type { SyncHarness } from './scenario-system';
import { lastMutationId, lastMutationOk } from './sync-observations';
import type { LedgerWrite } from './write-ledger';

export type WorkloadStep =
  | { readonly kind: 'append'; readonly device: number; readonly note: number }
  | { readonly kind: 'refused'; readonly device: number }
  | { readonly kind: 'wait'; readonly ms: number };

/** Shared notes the workload writes to (few, so devices collide). */
export const WORKLOAD_NOTES = 3;
const MAX_WAIT_MS = 20_000;

export function arbWorkloadStep(devices: number): fc.Arbitrary<WorkloadStep> {
  const device = fc.nat(devices - 1);
  return fc.oneof(
    {
      weight: 6,
      arbitrary: fc.record({
        kind: fc.constant('append' as const),
        device,
        note: fc.nat(WORKLOAD_NOTES - 1),
      }),
    },
    {
      weight: 1,
      arbitrary: fc.record({ kind: fc.constant('refused' as const), device }),
    },
    {
      weight: 2,
      arbitrary: fc.record({
        kind: fc.constant('wait' as const),
        ms: fc.integer({ min: 1, max: MAX_WAIT_MS }),
      }),
    }
  );
}

/**
 * Perform one step as device `devices[step.device]`. `n` numbers the step so
 * every written piece is unique. A write the device accepted joins `ledger`.
 */
export async function performWorkloadStep(
  s: Run<SyncHarness>,
  devices: readonly string[],
  step: WorkloadStep,
  out: { readonly n: number; readonly ledger: LedgerWrite[] }
): Promise<void> {
  if (step.kind === 'wait') {
    await s.advanceTime(step.ms);
    return;
  }
  const clientId = devices[step.device % devices.length]!;
  const piece = `<${clientId}#${out.n}>`;
  const refusable = step.kind === 'refused';
  const noteId = refusable ? `refused-${out.n}` : `shared-${step.note}`;
  if (refusable) {
    await s.apply(mutate, clientId, 'serverRejectNote', {
      id: noteId,
      body: piece,
    });
  } else {
    await s.apply(mutate, clientId, 'appendNote', { id: noteId, piece });
  }
  const mutationId = await s.read(lastMutationId, clientId);
  if (!(await s.read(lastMutationOk, clientId)) || mutationId === null) return;
  out.ledger.push({ clientId, mutationId, noteId, piece, refusable });
}

/**
 * A workload drawn from `seed` alone (no property runner), for evidence
 * runs that sweep a seed range: same seed ⇒ same steps.
 */
export function seededWorkload(
  seed: number,
  devices: number,
  maxSteps: number
): WorkloadStep[] {
  const rng = createSeededRng(seed).fork('workload');
  const steps: WorkloadStep[] = [];
  for (let i = 0, n = 1 + rng.int(maxSteps); i < n; i += 1) {
    const roll = rng.int(9);
    if (roll < 6) {
      steps.push({
        kind: 'append',
        device: rng.int(devices),
        note: rng.int(WORKLOAD_NOTES),
      });
    } else if (roll < 7) {
      steps.push({ kind: 'refused', device: rng.int(devices) });
    } else {
      steps.push({ kind: 'wait', ms: 1 + rng.int(MAX_WAIT_MS) });
    }
  }
  return steps;
}
