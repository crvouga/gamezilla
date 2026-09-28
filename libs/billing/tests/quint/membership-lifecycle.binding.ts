/**
 * `specs/billing/membership-lifecycle.qnt` against billing's lifecycle
 * composition (`tests/e2e/support/open-billing-lifecycle-harness.ts`): every
 * model action is one `billingStimulus`, so the lifecycle's standing
 * properties are checked after each (among them, that every connected device
 * knows every detail of every membership); the model's state is read back
 * from the memberships her computer knows (the server's rows), the ones her
 * phone knows (its own copy), whether her phone has a connection, and the
 * access each device shows.
 */

import { openBilling } from '@libs/billing/harness/billing-actions';
import {
  BILLING_PAYER,
  BILLING_SECOND_DEVICE,
  type BillingStimulus,
  billingStimulus,
  settleBilling,
} from '@libs/billing/harness/billing-lifecycle-stimuli';
import {
  billingTier,
  deviceMemberships,
  type MembershipRecord,
  serverMemberships,
} from '@libs/billing/harness/billing-reads';
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing/public/offer';
import {
  focusActor,
  signInWithGoogle,
  signInWithGoogleAsAccount,
  spawnActor,
} from '@libs/harness';
import type { QuintHarnessWorld } from '@libs/harness/quint/world';
import type { ProductHarness } from '@libs/harness/system/harness';
import { accountIdOf } from '@libs/harness/system/identity';
import { bringToFront, partitioned } from '@libs/harness/system/observations';
import type { QuintValue } from '@pkgs/quint/itf';
import { bindQuintModel } from '@pkgs/quint/registry';

const DEVICES = [BILLING_PAYER, BILLING_SECOND_DEVICE] as const;

function planOf(priceKey: string | null): string {
  const spec = Object.values(PLUS_MEMBERSHIP_OFFER.prices).find(
    (price) => price.key === priceKey
  );
  return spec?.interval ?? `unknown price ${String(priceKey)}`;
}

/** Numbered from 0, oldest first, as the model counts memberships. */
function modelled(records: readonly MembershipRecord[]): QuintValue {
  return new Map<QuintValue, QuintValue>(
    records.map((record, i) => [
      i,
      {
        status: record.status,
        plan: planOf(record.priceKey),
        endsAtPeriodEnd: record.cancelAtPeriodEnd,
      },
    ])
  );
}

/**
 * A device's own copy in the server's order: each device stamps its rows'
 * `created_at` when they reach it, so only the server's order is the
 * memberships' own.
 */
function inServerOrder(
  device: readonly MembershipRecord[],
  server: readonly MembershipRecord[]
): readonly MembershipRecord[] {
  const rank = (record: MembershipRecord) => {
    const i = server.findIndex(
      (r) => r.subscriptionId === record.subscriptionId
    );
    return i === -1 ? server.length : i;
  };
  return [...device].sort((a, b) => rank(a) - rank(b));
}

async function accessShownOn(
  s: ProductHarness,
  actorId: string
): Promise<string> {
  await bringToFront(s, actorId);
  return (await billingTier(s, actorId)) ?? 'nothing shown';
}

function phoneOnline(s: ProductHarness): boolean {
  return !partitioned(s).some((pair) =>
    pair.split('|').includes(BILLING_SECOND_DEVICE)
  );
}

function stimulus(name: BillingStimulus) {
  return async (w: QuintHarnessWorld) => {
    await w.s.apply(billingStimulus, name);
  };
}

bindQuintModel<QuintHarnessWorld>({
  model: 'membership-lifecycle',
  traces: 8,
  maxSteps: 15,
  timeoutMs: 180_000,
  actions: {
    init: async (w) => {
      await w.s.apply(signInWithGoogle, BILLING_PAYER);
      await w.s.apply(openBilling, BILLING_PAYER);
      await w.s.apply(spawnActor, BILLING_SECOND_DEVICE);
      await w.s.apply(
        signInWithGoogleAsAccount,
        BILLING_SECOND_DEVICE,
        BILLING_PAYER
      );
      await w.s.apply(openBilling, BILLING_SECOND_DEVICE);
      await w.s.read(settleBilling);
    },
    subscribe: async (w) => {
      await w.s.apply(focusActor, BILLING_PAYER);
      await w.s.apply(billingStimulus, 'subscribe');
    },
    periodEnd: stimulus('period_end'),
    paymentFailed: stimulus('payment_failed'),
    paymentRecovered: stimulus('payment_recovered'),
    paymentRetriesExhausted: stimulus('payment_retries_exhausted'),
    cancel: stimulus('cancel_at_period_end'),
    renewInBillingPortal: stimulus('resume'),
    cancelImmediately: stimulus('cancel_now'),
    switchPlan: stimulus('switch_interval'),
    providerRepeatsNews: stimulus('redeliver_last_event'),
    resubscribe: stimulus('resubscribe'),
    _phoneGoesOffline: stimulus('second_device_offline'),
    _phoneBackOnline: stimulus('second_device_online'),
  },
  observe: async (w) => {
    const accountId = await w.quiet.read(accountIdOf, BILLING_PAYER);
    if (accountId === null) throw new Error('the payer is signed out');
    const server = await w.quiet.read(serverMemberships, accountId);
    const phone = await w.quiet.read(
      deviceMemberships,
      BILLING_SECOND_DEVICE,
      accountId
    );
    const accessOn = new Map<QuintValue, QuintValue>();
    for (const device of DEVICES) {
      accessOn.set(device, await w.quiet.read(accessShownOn, device));
    }
    return {
      memberships: modelled(server),
      membershipsOnPhone: modelled(inServerOrder(phone, server)),
      _phoneOnline: await w.quiet.read(phoneOnline),
      accessOn,
    };
  },
});
