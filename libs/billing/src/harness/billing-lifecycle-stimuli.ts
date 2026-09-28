/**
 * The membership lifecycle's stimuli, one scripted step at a time. One payer
 * (`BILLING_PAYER`) and a second device signed into the same account
 * (`BILLING_SECOND_DEVICE`); a stimulus is subscribing from the plans screen,
 * anything a tester does at the provider in test mode — a renewal, a failed
 * or recovered charge, a cancellation, a price switch, a redelivered webhook,
 * a resubscribe — or the second device dropping off / coming back on the
 * network. Every stimulus settles: the provider is read (which runs whatever
 * is due), then virtual time runs long enough for webhooks and sync pushes to
 * land. The lifecycle's standing properties
 * (`billing-lifecycle-properties.ts`) are checked after each one; the Quint
 * model `specs/billing/membership-lifecycle.qnt` drives them.
 *
 * Billing time moves on the provider's per-customer test clock, as in Stripe
 * test mode, not on the app's: a virtual hour of the whole app costs seconds of
 * real time (every heartbeat and poll fires), so days of grace are covered by
 * the plan resolver's own state-space tests (`@libs/permissions`), not here.
 */

import { partition, restoreNetwork } from '@libs/harness/system/actions';
import type { ProductHarness } from '@libs/harness/system/harness';
import { accountIdOf } from '@libs/harness/system/identity';
import { partitioned } from '@libs/harness/system/observations';
import { defineAction } from '@pkgs/harness';

import { checkoutPlusAtProvider, subscribeToPlus } from './billing-actions';
import {
  BILLING_OBSERVE_KINDS,
  customerOf,
  driveProvider,
  membershipProviderOf,
  providerSubscriptions,
} from './billing-provider-driver';

export const BILLING_PAYER = 'alice';
export const BILLING_SECOND_DEVICE = 'alice-phone';

const SETTLE_STEP_MS = 5000;
const SETTLE_STEPS = 3;

export const BILLING_STIMULI = [
  'subscribe',
  ...BILLING_OBSERVE_KINDS,
  'resubscribe',
  'second_device_offline',
  'second_device_online',
] as const;

export type BillingStimulus = (typeof BILLING_STIMULI)[number];

const LIVE = new Set(['trialing', 'active']);
const ENDED = new Set(['canceled', 'unpaid', 'incomplete_expired']);

type ProviderView = {
  readonly status: string | null;
  readonly cancelAtPeriodEnd: boolean;
};

async function providerView(s: ProductHarness): Promise<ProviderView> {
  const none = { status: null, cancelAtPeriodEnd: false };
  const accountId = await accountIdOf(s, BILLING_PAYER);
  if (accountId === null) return none;
  const provider = await membershipProviderOf(s, accountId);
  let customer: string;
  try {
    customer = await customerOf(s, accountId, provider);
  } catch {
    return none; // Never checked out: the provider knows no customer yet.
  }
  const latest = (await providerSubscriptions(customer, provider))[0];
  return {
    status: latest?.status ?? null,
    cancelAtPeriodEnd: latest?.cancel_at_period_end ?? false,
  };
}

function secondDeviceOffline(s: ProductHarness): boolean {
  return partitioned(s).some((pair) =>
    pair.split('|').includes(BILLING_SECOND_DEVICE)
  );
}

/** What a tester could do at the provider right now, plus the network toggles. */
export async function legalStimuli(
  s: ProductHarness
): Promise<readonly BillingStimulus[]> {
  const view = await providerView(s);
  const out: BillingStimulus[] = [];
  if (view.status === null) out.push('subscribe');
  else out.push('redeliver_last_event');
  if (view.status !== null && LIVE.has(view.status)) {
    out.push('period_end', 'payment_failed', 'cancel_now', 'switch_interval');
    out.push(view.cancelAtPeriodEnd ? 'resume' : 'cancel_at_period_end');
  }
  if (view.status === 'past_due') {
    out.push('payment_recovered', 'payment_retries_exhausted', 'cancel_now');
  }
  if (view.status !== null && ENDED.has(view.status)) out.push('resubscribe');
  if (s.session.caps.has('partition')) {
    out.push(
      secondDeviceOffline(s) ? 'second_device_online' : 'second_device_offline'
    );
  }
  return out;
}

/** Let the provider run what is due, then let webhooks and pushes land. */
export async function settleBilling(s: ProductHarness): Promise<void> {
  await providerView(s);
  for (let i = 0; i < SETTLE_STEPS; i += 1) {
    await s.session.advanceTime(SETTLE_STEP_MS);
    await s.session.waitForIdle();
  }
}

async function stimulate(
  s: ProductHarness,
  stimulus: BillingStimulus
): Promise<void> {
  const accountId = await accountIdOf(s, BILLING_PAYER);
  if (accountId === null)
    throw new Error('billing lifecycle: the payer is signed out');
  if (stimulus === 'subscribe') {
    await Promise.resolve(subscribeToPlus.act(s, BILLING_PAYER));
  } else if (stimulus === 'resubscribe') {
    await Promise.resolve(checkoutPlusAtProvider.act(s, BILLING_PAYER));
  } else if (stimulus === 'second_device_offline') {
    await Promise.resolve(partition.act(s, BILLING_SECOND_DEVICE));
  } else if (stimulus === 'second_device_online') {
    await Promise.resolve(restoreNetwork.act(s));
  } else {
    await driveProvider(s, accountId, stimulus);
    await s.session.waitForIdle();
  }
  await settleBilling(s);
}

/**
 * One lifecycle step, scripted: `stimulus` must be one the provider's state
 * allows right now (`legalStimuli`), or the step fails — a caller that thinks
 * otherwise disagrees with the product about where the membership is.
 */
export const billingStimulus = defineAction({
  name: 'billingStimulus',
  pool: false,
  act: async (s: ProductHarness, stimulus: BillingStimulus) => {
    const legal = await legalStimuli(s);
    if (!legal.includes(stimulus)) {
      throw new Error(
        `billing lifecycle: "${stimulus}" is not possible now (possible: ${legal.join(', ')})`
      );
    }
    await stimulate(s, stimulus);
  },
});
