/**
 * The membership lifecycle as a property test: seeded random walks of
 * provider stimuli (renewals, failed and recovered charges, cancellations,
 * price switches, redeliveries, resubscribes) and a second device going
 * offline and back, with the lifecycle's standing properties checked after
 * every step (`billing-lifecycle-properties.ts`).
 */
import { describe, expect, test } from 'bun:test';
import {
  openBilling,
  subscribeToPlus,
} from '@libs/billing/sim/billing-actions';
import {
  BILLING_PAYER,
  BILLING_SECOND_DEVICE,
  BILLING_STIMULI,
  billingStimulus,
  settleBilling,
} from '@libs/billing/sim/billing-lifecycle-walk';
import {
  signInWithGoogle,
  signInWithGoogleAsAccount,
  spawnActor,
} from '@libs/sim-harness';
import { openLifecycleSim } from './support/open-billing-lifecycle-sim';

/** Each seed walks its own path; together they reach every stimulus. */
const SEEDS = [1, 2, 3, 4, 5];
const STEPS = 36;

async function walk(seed: number): Promise<readonly string[]> {
  const testId = `billing-lifecycle-walk-${String(seed)}`;
  await using s = await openLifecycleSim(testId, seed);
  await s.apply(signInWithGoogle, BILLING_PAYER);
  await s.apply(openBilling, BILLING_PAYER);
  await s.apply(subscribeToPlus, BILLING_PAYER);
  await s.apply(spawnActor, BILLING_SECOND_DEVICE);
  await s.apply(
    signInWithGoogleAsAccount,
    BILLING_SECOND_DEVICE,
    BILLING_PAYER
  );
  await s.apply(openBilling, BILLING_SECOND_DEVICE);
  await s.read(settleBilling);

  const report = await s.randomActions({
    actions: [billingStimulus],
    steps: STEPS,
  });
  const taken = report.steps
    .filter((step) => step.action === billingStimulus.name)
    .map((step) => String(step.args[0]));
  if (report.violations.length > 0) {
    throw new Error(
      `${testId}: ${report.violations.map((v) => v.error).join('; ')}\nwalk:\n${taken.map((t, i) => `  ${String(i + 1)}. ${t}`).join('\n')}`
    );
  }
  return taken;
}

describe('billing lifecycle walk', () => {
  test('every reachable lifecycle holds the standing properties', async () => {
    const reached = new Set<string>();
    for (const seed of SEEDS) {
      for (const stimulus of await walk(seed)) reached.add(stimulus);
    }
    // Walks that never reached a stimulus proved nothing about it.
    expect(
      [...BILLING_STIMULI].filter((stimulus) => !reached.has(stimulus))
    ).toEqual([]);
  }, 240_000);
});
