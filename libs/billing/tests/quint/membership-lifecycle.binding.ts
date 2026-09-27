/**
 * `specs/billing/membership-lifecycle.qnt` against billing's lifecycle
 * composition (`tests/e2e/support/open-billing-lifecycle-sim.ts`): every
 * model action is one `billingStimulus`, so the lifecycle's standing
 * properties are checked after each (among them, that every online device
 * holds the server's rows to the last column); the model's state is read back
 * from the server's membership rows, the second device's own copy, the
 * network, and the tier each device shows.
 */

import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing/public/offer';
import { openBilling } from '@libs/billing/sim/billing-actions';
import {
  BILLING_PAYER,
  BILLING_SECOND_DEVICE,
  type BillingStimulus,
  billingStimulus,
  settleBilling,
} from '@libs/billing/sim/billing-lifecycle-stimuli';
import {
  billingTier,
  deviceMemberships,
  type MembershipRecord,
  serverMemberships,
} from '@libs/billing/sim/billing-reads';
import {
  focusActor,
  signInWithGoogle,
  signInWithGoogleAsAccount,
  spawnActor,
} from '@libs/sim-harness';
import type { QuintSimWorld } from '@libs/sim-harness/quint/world';
import { accountIdOf } from '@libs/sim-harness/system/identity';
import {
  bringToFront,
  partitioned,
} from '@libs/sim-harness/system/observations';
import type { ProductSim } from '@libs/sim-harness/system/sim';
import type { QuintValue } from '@pkgs/quint/itf';
import { bindQuintModel } from '@pkgs/quint/registry';

const DEVICES = [BILLING_PAYER, BILLING_SECOND_DEVICE] as const;

function intervalOf(priceKey: string | null): string {
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
        interval: intervalOf(record.priceKey),
        cancelAtPeriodEnd: record.cancelAtPeriodEnd,
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

async function shownTier(s: ProductSim, actorId: string): Promise<string> {
  await bringToFront(s, actorId);
  return (await billingTier(s, actorId)) ?? 'nothing shown';
}

function phoneOnline(s: ProductSim): boolean {
  return !partitioned(s).some((pair) =>
    pair.split('|').includes(BILLING_SECOND_DEVICE)
  );
}

function stimulus(name: BillingStimulus) {
  return async (w: QuintSimWorld) => {
    await w.s.apply(billingStimulus, name);
  };
}

bindQuintModel<QuintSimWorld>({
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
    cancelAtPeriodEnd: stimulus('cancel_at_period_end'),
    resume: stimulus('resume'),
    cancelNow: stimulus('cancel_now'),
    switchInterval: stimulus('switch_interval'),
    redeliverLastEvent: stimulus('redeliver_last_event'),
    resubscribe: stimulus('resubscribe'),
    secondDeviceOffline: stimulus('second_device_offline'),
    secondDeviceOnline: stimulus('second_device_online'),
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
    const tier = new Map<QuintValue, QuintValue>();
    for (const device of DEVICES) {
      tier.set(device, await w.quiet.read(shownTier, device));
    }
    return {
      memberships: modelled(server),
      phoneMemberships: modelled(inServerOrder(phone, server)),
      phoneOnline: await w.quiet.read(phoneOnline),
      tier,
    };
  },
});
