/**
 * Product scenario actions for the plus membership. A person acts in the app
 * and on the provider's hosted pages; `observeMembership` is the tester acting
 * at the provider (test clocks, test cards, subscription updates), whose
 * effect reaches the app only as a signed webhook.
 */

import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing-shared/plus-membership-offer';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { accountIdOf } from '@libs/harness/identity';
import { nodeText } from '@libs/harness/observations';
import {
  HARNESS_FIRST_BILLING_PROVIDER,
  HARNESS_SERVER_URL,
} from '@libs/sub-shared/harness-constants';
import { Handles } from '@libs/test-ids-shared/handles';
import type {
  BillingObserveKind,
  EarlierNews,
} from './billing-provider-driver';
import {
  billingProviders,
  customerOf,
  driveProvider,
  expireCardOnFile,
  refundLastPayment,
  repeatEarlierNews,
  runBillingPeriodOn,
  runOutBillingPeriod,
} from './billing-provider-driver';
import { billingButtonEnabled } from './billing-reads';

const WAIT_MS = 20_000;

/**
 * The `data-testid`s of Stripe's hosted checkout and billing portal, as the
 * Stripe mock serves them.
 */
const STRIPE_PAGE = {
  checkoutCard: 'stripe-mock-card',
  checkoutExpiry: 'stripe-mock-exp',
  checkoutCvc: 'stripe-mock-cvc',
  checkoutZip: 'stripe-mock-zip',
  checkoutPay: 'stripe-mock-pay',
  checkoutCancel: 'stripe-mock-cancel',
  portalReturn: 'stripe-mock-portal-return',
  portalNotice: 'stripe-mock-portal-notice',
  portalCancelPlan: 'stripe-mock-portal-cancel-plan',
  portalCancelReason: (reason: string) => `stripe-mock-portal-reason-${reason}`,
  portalCancelConfirm: 'stripe-mock-portal-cancel-confirm',
  portalRenew: 'stripe-mock-portal-renew',
  portalUpdatePlan: 'stripe-mock-portal-update-plan',
  portalPriceOption: (lookupKey: string) =>
    `stripe-mock-portal-price-option-${lookupKey}`,
  portalContinue: 'stripe-mock-portal-continue',
  portalConfirmUpdate: 'stripe-mock-portal-confirm-update',
  portalAddPaymentMethod: 'stripe-mock-portal-add-payment-method',
  portalCard: 'stripe-mock-portal-card',
  portalExpiry: 'stripe-mock-portal-exp',
  portalCvc: 'stripe-mock-portal-cvc',
  portalZip: 'stripe-mock-portal-zip',
  portalSaveCard: 'stripe-mock-portal-save-card',
  portalPayInvoice: 'stripe-mock-portal-pay-invoice',
} as const;

/** A working test card, as a person types it into a card form. */
const TEST_CARD = {
  number: '4242424242424242',
  expiry: '12 / 34',
  cvc: '123',
  zip: '94107',
} as const;

/**
 * Press one of the billing screen's own buttons once it accepts a press. Each
 * stays disabled on its "Opening…" face for a moment after it opened the
 * provider's page, and a press on a disabled button does nothing, so a person
 * back from the provider waits for it, as this does.
 */
async function pressBillingButton(
  s: ProductHarness,
  actorId: string,
  which: 'subscribe' | 'manage'
): Promise<void> {
  await pollUntil(
    s,
    async () => ((await billingButtonEnabled(s, actorId, which)) ? true : null),
    {
      maxMs: WAIT_MS,
      description: `the billing ${which} button to accept a press`,
    }
  );
  const ui = await actorUi(s, actorId);
  await ui
    .get(
      which === 'subscribe' ? Handles.billingSubscribe : Handles.billingManage
    )
    .tap({ timeoutMs: WAIT_MS });
}

/** Global menu → Settings → Billing. */
export const openBilling = scenarioAction({
  name: 'openBilling',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.statusCurrentUser).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.globalMenuSettings).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.settingsBilling).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.billingScreen).expect.visible({ timeoutMs: WAIT_MS });
  },
});

/**
 * Subscribe to plus: the app hands off to the provider's hosted checkout in
 * the actor's browser, the person types a card there and pays, and the
 * checkout returns to the app. Then wait for the tier to read `paid`.
 */
export const subscribeToPlus = scenarioAction({
  name: 'subscribeToPlus',
  act: async (s, actorId: string) => {
    await pressBillingButton(s, actorId, 'subscribe');
    const ui = await actorUi(s, actorId);
    await ui
      .get(STRIPE_PAGE.checkoutCard)
      .input(TEST_CARD.number, { timeoutMs: WAIT_MS });
    await ui.get(STRIPE_PAGE.checkoutExpiry).input(TEST_CARD.expiry);
    await ui.get(STRIPE_PAGE.checkoutCvc).input(TEST_CARD.cvc);
    await ui.get(STRIPE_PAGE.checkoutZip).input(TEST_CARD.zip);
    await ui.get(STRIPE_PAGE.checkoutPay).tap({ timeoutMs: WAIT_MS });
    await pollUntil(
      s,
      async () =>
        (await nodeText(s, actorId, [Handles.billingTier])) === 'paid'
          ? true
          : null,
      { maxMs: WAIT_MS, description: 'billing tier paid' }
    );
  },
});

/**
 * Start subscribing, then leave the provider's checkout without paying: its
 * own back link returns to the app's billing screen.
 */
export const leaveCheckout = scenarioAction({
  name: 'leaveCheckout',
  act: async (s, actorId: string) => {
    await pressBillingButton(s, actorId, 'subscribe');
    const ui = await actorUi(s, actorId);
    await ui.get(STRIPE_PAGE.checkoutCancel).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.billingScreen).expect.visible({ timeoutMs: WAIT_MS });
  },
});

/** Open the provider's portal so the person can manage their plan. */
export const managePlus = scenarioAction({
  name: 'managePlus',
  act: async (s, actorId: string) => {
    await pressBillingButton(s, actorId, 'manage');
    const ui = await actorUi(s, actorId);
    await ui
      .get(STRIPE_PAGE.portalReturn)
      .expect.visible({ timeoutMs: WAIT_MS });
  },
});

type PortalUi = Awaited<ReturnType<typeof actorUi>>;

/** Wait for the portal to confirm the change it just made. */
async function portalConfirmed(ui: PortalUi): Promise<void> {
  await ui.get(STRIPE_PAGE.portalNotice).expect.visible({ timeoutMs: WAIT_MS });
}

/**
 * Open the portal, make a change there (`change` taps through the portal's own
 * pages and waits for it to confirm), then take the portal's own link back to
 * the app.
 */
async function inPortal(
  s: ProductHarness,
  actorId: string,
  change: (ui: PortalUi) => Promise<void>
): Promise<void> {
  await pressBillingButton(s, actorId, 'manage');
  const ui = await actorUi(s, actorId);
  await change(ui);
  await ui.get(STRIPE_PAGE.portalReturn).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.billingScreen).expect.visible({ timeoutMs: WAIT_MS });
}

/** Cancel the plan, saying why: it stops at the end of the period. */
export const cancelPlus = scenarioAction({
  name: 'cancelPlus',
  act: async (s, actorId: string) => {
    await inPortal(s, actorId, async (ui) => {
      await ui.get(STRIPE_PAGE.portalCancelPlan).tap({ timeoutMs: WAIT_MS });
      const [reason] = PLUS_MEMBERSHIP_OFFER.portal.cancellationReasons;
      if (reason !== undefined) {
        await ui
          .get(STRIPE_PAGE.portalCancelReason(reason))
          .tap({ timeoutMs: WAIT_MS });
      }
      await ui.get(STRIPE_PAGE.portalCancelConfirm).tap({ timeoutMs: WAIT_MS });
      await portalConfirmed(ui);
    });
  },
});

/** Renew a plan set to cancel at the end of the period. */
export const resumePlus = scenarioAction({
  name: 'resumePlus',
  act: async (s, actorId: string) => {
    await inPortal(s, actorId, async (ui) => {
      await ui.get(STRIPE_PAGE.portalRenew).tap({ timeoutMs: WAIT_MS });
      await portalConfirmed(ui);
    });
  },
});

/** In the portal: add a new, working card, then pay the unpaid invoice with it. */
export const payWithNewCard = scenarioAction({
  name: 'payWithNewCard',
  act: async (s, actorId: string) => {
    await inPortal(s, actorId, async (ui) => {
      await ui
        .get(STRIPE_PAGE.portalAddPaymentMethod)
        .tap({ timeoutMs: WAIT_MS });
      await ui
        .get(STRIPE_PAGE.portalCard)
        .input(TEST_CARD.number, { timeoutMs: WAIT_MS });
      await ui.get(STRIPE_PAGE.portalExpiry).input(TEST_CARD.expiry);
      await ui.get(STRIPE_PAGE.portalCvc).input(TEST_CARD.cvc);
      await ui.get(STRIPE_PAGE.portalZip).input(TEST_CARD.zip);
      await ui.get(STRIPE_PAGE.portalSaveCard).tap({ timeoutMs: WAIT_MS });
      await portalConfirmed(ui);
      await ui.get(STRIPE_PAGE.portalPayInvoice).tap({ timeoutMs: WAIT_MS });
      await portalConfirmed(ui);
    });
  },
});

/** Switch the plan to the offer price `priceKey`, confirming the change. */
export const switchPlusInterval = scenarioAction({
  name: 'switchPlusInterval',
  act: async (s, actorId: string, priceKey: string) => {
    const lookupKey =
      PLUS_MEMBERSHIP_OFFER.prices[
        priceKey as keyof typeof PLUS_MEMBERSHIP_OFFER.prices
      ]?.catalogPriceId ?? priceKey;
    await inPortal(s, actorId, async (ui) => {
      await ui.get(STRIPE_PAGE.portalUpdatePlan).tap({ timeoutMs: WAIT_MS });
      await ui
        .get(STRIPE_PAGE.portalPriceOption(lookupKey))
        .tap({ timeoutMs: WAIT_MS });
      await ui.get(STRIPE_PAGE.portalContinue).tap({ timeoutMs: WAIT_MS });
      await ui.get(STRIPE_PAGE.portalConfirmUpdate).tap({ timeoutMs: WAIT_MS });
      await portalConfirmed(ui);
    });
  },
});

/**
 * Drive one lifecycle transition at the provider, then let its webhook reach
 * the app. Guests (no signed-in account) have nothing to observe.
 */
export const observeMembership = scenarioAction({
  name: 'observeMembership',
  act: async (s, actorId: string, kind: BillingObserveKind) => {
    const accountId = await accountIdOf(s, actorId);
    if (accountId === null) return;
    await driveProvider(s, accountId, kind);
    await s.session.waitForIdle();
  },
});

/**
 * Provider-side events a tester or the provider's support staff sets off for
 * the actor's customer: a refund of the last payment (with the subscription
 * canceled at once), the card on file passing its expiry, and the billing
 * period running out for everyone (time passes for the app too). Each lets
 * its webhooks reach the app.
 */
const PROVIDER_EVENTS = {
  refund: refundLastPayment,
  expire_card: expireCardOnFile,
  run_out_period: runOutBillingPeriod,
} as const;

export type ProviderEvent = keyof typeof PROVIDER_EVENTS;

export const providerEvent = scenarioAction({
  name: 'providerEvent',
  act: async (s, actorId: string, event: ProviderEvent) => {
    const accountId = await accountIdOf(s, actorId);
    if (accountId === null) throw new Error(`${actorId} is not signed in`);
    await PROVIDER_EVENTS[event](s, accountId);
    await s.session.waitForIdle();
  },
});

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Days go by for everyone — the device, the server and the provider — until
 * the actor's free trial has `days` days left, and that reaches the app.
 */
export const runFreeTrialToDaysLeft = scenarioAction({
  name: 'runFreeTrialToDaysLeft',
  act: async (s, actorId: string, days: number) => {
    const accountId = await accountIdOf(s, actorId);
    if (accountId === null) throw new Error(`${actorId} is not signed in`);
    await runBillingPeriodOn(s, accountId, days * DAY_MS);
    await s.session.waitForIdle();
  },
});

/**
 * Start and pay a fresh checkout for the actor's customer at the provider —
 * the session the app's own checkout would create, completed with a working
 * test card through the provider's test controls. The lifecycle walk's
 * `resubscribe` stimulus: a provider-side step that works whatever screen the
 * payer is on.
 */
export const checkoutPlusAtProvider = scenarioAction({
  name: 'checkoutPlusAtProvider',
  act: async (s, actorId: string) => {
    const accountId = await accountIdOf(s, actorId);
    if (accountId === null) return;
    const provider = billingProviders(s).checkout();
    const spec =
      PLUS_MEMBERSHIP_OFFER.prices[PLUS_MEMBERSHIP_OFFER.defaultPriceKey];
    const prices = await provider.stripe.prices.list({
      lookup_keys: [spec.catalogPriceId],
      limit: 1,
    });
    const price = prices.data[0]?.id;
    if (price === undefined) {
      throw new Error(`billing: no price ${spec.catalogPriceId}`);
    }
    const returnUrl = `${HARNESS_SERVER_URL}${PLUS_MEMBERSHIP_OFFER.portal.defaultReturnUrlPath}`;
    const session = await provider.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: await customerOf(s, accountId, provider),
      client_reference_id: accountId,
      line_items: [{ price, quantity: 1 }],
      success_url: returnUrl,
      cancel_url: returnUrl,
      subscription_data: {
        metadata: { accountId },
        trial_period_days: spec.trialPeriodDays,
      },
    });
    const completed = await provider.fetch(
      `${provider.origin}/__admin/checkout/sessions/${session.id}/complete`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ card: TEST_CARD.number }),
      }
    );
    if (!completed.ok) {
      throw new Error(
        `billing: completing checkout ${session.id} → ${String(completed.status)}: ${await completed.text()}`
      );
    }
    await s.session.waitForIdle();
  },
});

/**
 * The harness's payment providers, by the id the app knows each by. The first is
 * the one every harness boots with; the second boots the first time the team
 * switches payment provider to it.
 */
export const FIRST_PAYMENT_PROVIDER = HARNESS_FIRST_BILLING_PROVIDER;
export const SECOND_PAYMENT_PROVIDER = 'stripe-second';

/**
 * The team switches payment provider: new checkouts go to provider
 * `providerId` from now on, while every earlier provider keeps serving its
 * members. Switching back names the first provider.
 */
export const switchPaymentProvider = scenarioAction({
  name: 'switchPaymentProvider',
  act: async (s, providerId: string) => {
    await billingProviders(s).switchCheckout(providerId);
  },
});

/**
 * Provider `providerId` delivers again news it already sent about the
 * actor's memberships there — late, and as it was then — and it reaches the
 * app.
 */
export const repeatProviderNews = scenarioAction({
  name: 'repeatProviderNews',
  act: async (s, actorId: string, providerId: string, news: EarlierNews) => {
    const accountId = await accountIdOf(s, actorId);
    if (accountId === null) throw new Error(`${actorId} is not signed in`);
    await repeatEarlierNews(s, accountId, providerId, news);
    await s.session.waitForIdle();
  },
});

/** Advance virtual time (the grace-window escape hatch). */
export const advanceBillingClock = scenarioAction({
  name: 'advanceBillingClock',
  act: async (s, _actorId: string, ms: number) => {
    if (!s.session.caps.has('virtualTime')) return;
    await s.session.advanceTime(ms);
    await s.session.waitForIdle();
  },
});

/** Registered on every system that composes this sub. */
export const BILLING_HARNESS_ACTIONS = [
  openBilling,
  subscribeToPlus,
  leaveCheckout,
  managePlus,
  cancelPlus,
  payWithNewCard,
  providerEvent,
  runFreeTrialToDaysLeft,
  checkoutPlusAtProvider,
  resumePlus,
  switchPlusInterval,
  observeMembership,
  switchPaymentProvider,
  repeatProviderNews,
  advanceBillingClock,
];
