/**
 * `specs/billing/grace-and-refunds.qnt` against the billing lifecycle.
 * Each action is the same one the grace and refund scenarios already run:
 * the trial ending, a canceled period ending, days passing, a refund, and
 * the phone losing and regaining its connection. What each device shows is
 * read back as paid or free access.
 */

import {
  cancelPlus,
  observeMembership,
  openBilling,
  providerEvent,
} from '@libs/billing-harness-ts/billing-actions';
import {
  BILLING_PAYER,
  BILLING_SECOND_DEVICE,
  billingStimulus,
} from '@libs/billing-harness-ts/billing-lifecycle-stimuli';
import {
  billingTier,
  membershipShown,
} from '@libs/billing-harness-ts/billing-reads';
import { letTimePass, spawnActor } from '@libs/harness-ts/actions';
import {
  signInWithGoogle,
  signInWithGoogleAsAccount,
} from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';
import type { QuintHarnessWorld } from '@libs/harness-ts/quint-world';
import { focusActor } from '@libs/harness-ts/shell-actions';
import type { QuintValue } from '@pkgs/quint-shared-ts/itf';
import type { Picks } from '@pkgs/quint-shared-ts/registry';
import { bindQuintModel } from '@pkgs/quint-shared-ts/registry';
import refundableTrial from './fixtures/billing-seven-day-trial-can-be-refunded.itf.json';
import offlineTrial from './fixtures/billing-trial-ends-while-phone-offline.itf.json';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEVICES = [BILLING_PAYER, BILLING_SECOND_DEVICE] as const;

async function accessShownOn(
  s: ProductHarness,
  actorId: string
): Promise<string> {
  await bringToFront(s, actorId);
  const tier = await billingTier(s, actorId);
  return tier === 'paid' || tier === 'free' ? tier : 'unshown';
}

bindQuintModel<QuintHarnessWorld>({
  model: 'grace-and-refunds',
  traces: 64,
  maxSteps: 10,
  timeoutMs: 180_000,
  regressions: [
    {
      // regression: billing-seven-day-trial-can-be-refunded
      id: 'billing-seven-day-trial-can-be-refunded',
      title: 'Seven days offline end the trial before a refund',
      seed: '0x67932',
      itf: refundableTrial,
    },
    {
      // regression: billing-trial-ends-while-phone-offline
      id: 'billing-trial-ends-while-phone-offline',
      title: 'Eight offline days end the trial before the phone returns',
      seed: '0x67932',
      itf: offlineTrial,
    },
  ],
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
      await w.s.apply(focusActor, BILLING_PAYER);
      await w.s.apply(billingStimulus, 'subscribe');
    },
    trialEnds: async (w) => {
      // The trial ending is the provider's clock alone. Moving the app's
      // clock here would spend the paid period before grace starts.
      await w.s.apply(focusActor, BILLING_PAYER);
      await w.s.apply(observeMembership, BILLING_PAYER, 'period_end');
      await w.s.until((s) => membershipShown(s, BILLING_PAYER), {
        pred: (shown) =>
          shown !== null &&
          shown.state !== 'trialing' &&
          shown.state !== 'canceling',
        maxMs: 15_000,
      });
    },
    endCanceledPeriod: async (w) => {
      await w.s.apply(focusActor, BILLING_PAYER);
      await w.s.apply(cancelPlus, BILLING_PAYER);
      await w.s.apply(providerEvent, BILLING_PAYER, 'run_out_period');
    },
    daysPass: async (w, picks: Picks) => {
      // The actions around a day (a connection settling, the trial ending)
      // already move the clock by seconds. Land inside the model's day so
      // the 7th day is still paid and the 8th is free.
      const slopMs = 60_000;
      const days = Number(picks['n']);
      await w.s.apply(letTimePass, days * DAY_MS - slopMs);
      const trialDays = Number(w.memo.get('trial-days') ?? 0) + days;
      w.memo.set('trial-days', trialDays);
      // Access stays inside the day's boundary; the provider still reaches
      // the seven-day trial end and charges its first paid renewal.
      if (trialDays >= 7) {
        const shown = await w.s.read(membershipShown, BILLING_PAYER);
        if (shown?.state === 'trialing')
          await w.s.apply(observeMembership, BILLING_PAYER, 'period_end');
      }
    },
    refund: async (w) => {
      await w.s.apply(focusActor, BILLING_PAYER);
      await w.s.apply(providerEvent, BILLING_PAYER, 'refund');
    },
    _loseConnection: async (w) => {
      await w.s.apply(billingStimulus, 'second_device_offline');
    },
    _connectionReturns: async (w) => {
      await w.s.apply(billingStimulus, 'second_device_online');
    },
  },
  observe: async (w) => {
    const accessOn = new Map<QuintValue, QuintValue>();
    for (const device of DEVICES)
      accessOn.set(device, await w.quiet.read(accessShownOn, device));
    return { accessOn };
  },
});
