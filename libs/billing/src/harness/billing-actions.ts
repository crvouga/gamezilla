/**
 * Product scenario actions for the plus membership. A person acts in the app
 * and on the provider's hosted pages; `observeMembership` is the tester acting
 * at the provider (test clocks, test cards, subscription updates), whose
 * effect reaches the app only as a signed webhook.
 */

import {
  HARNESS_FIRST_BILLING_PROVIDER,
  HARNESS_SERVER_URL,
} from '@libs/feature/public/harness-constants';
import {
  actorUi,
  pollUntil,
  scenarioAction,
} from '@libs/harness/system/actor-ui';
import type { ProductHarness } from '@libs/harness/system/harness';
import { accountIdOf } from '@libs/harness/system/identity';
import { nodeText } from '@libs/harness/system/observations';
import { Handles } from '@libs/test-ids';
import {
  MOCK_BILLING_PATHS,
  MOCK_TEST_PAYMENT_METHODS,
  type MockCheckoutSession,
  type MockList,
  type MockPrice,
} from '@pkgs/billing-mock';
import {
  MOCK_BILLING_PAGE_API,
  MOCK_BILLING_TEST_IDS,
} from '@pkgs/billing-mock-provider/shared';

import { PLUS_MEMBERSHIP_OFFER } from '../public/offer';
import {
  type BillingObserveKind,
  billingProviders,
  customerOf,
  driveProvider,
  type EarlierNews,
  expireCardOnFile,
  providerCall,
  refundLastPayment,
  repeatEarlierNews,
  runBillingPeriodOn,
  runOutBillingPeriod,
} from './billing-provider-driver';
import { billingButtonEnabled } from './billing-reads';

export {
  BILLING_OBSERVE_KINDS,
  type BillingObserveKind,
  type EarlierNews,
} from './billing-provider-driver';

const WAIT_MS = 20_000;

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
 * the actor's browser, the person pays there, and the checkout returns to the
 * app. Then wait for the tier to read `paid`.
 */
export const subscribeToPlus = scenarioAction({
  name: 'subscribeToPlus',
  act: async (s, actorId: string) => {
    await pressBillingButton(s, actorId, 'subscribe');
    const ui = await actorUi(s, actorId);
    await ui.get(MOCK_BILLING_TEST_IDS.checkoutPay).tap({ timeoutMs: WAIT_MS });
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
    await ui
      .get(MOCK_BILLING_TEST_IDS.checkoutCancel)
      .tap({ timeoutMs: WAIT_MS });
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
      .get(MOCK_BILLING_TEST_IDS.portalReturn)
      .expect.visible({ timeoutMs: WAIT_MS });
  },
});

/**
 * Open the portal, press `buttons` in order (a destructive change opens its
 * confirmation first), wait for the portal to confirm the change, then take
 * the portal's own link back to the app.
 */
async function inPortal(
  s: ProductHarness,
  actorId: string,
  buttons: readonly string[]
): Promise<void> {
  await pressBillingButton(s, actorId, 'manage');
  const ui = await actorUi(s, actorId);
  for (const testId of buttons) {
    await ui.get(testId).tap({ timeoutMs: WAIT_MS });
  }
  await ui
    .get(MOCK_BILLING_TEST_IDS.portalNotice)
    .expect.visible({ timeoutMs: WAIT_MS });
  await ui.get(MOCK_BILLING_TEST_IDS.portalReturn).tap({ timeoutMs: WAIT_MS });
  await ui.get(Handles.billingScreen).expect.visible({ timeoutMs: WAIT_MS });
}

export const cancelPlus = scenarioAction({
  name: 'cancelPlus',
  act: async (s, actorId: string) => {
    await inPortal(s, actorId, [
      MOCK_BILLING_TEST_IDS.portalCancelStart,
      MOCK_BILLING_TEST_IDS.portalCancel,
    ]);
  },
});

export const resumePlus = scenarioAction({
  name: 'resumePlus',
  act: async (s, actorId: string) => {
    await inPortal(s, actorId, [MOCK_BILLING_TEST_IDS.portalRenew]);
  },
});

/** In the portal: pay the unpaid invoice with a new, working card. */
export const payWithNewCard = scenarioAction({
  name: 'payWithNewCard',
  act: async (s, actorId: string) => {
    await inPortal(s, actorId, [
      MOCK_BILLING_TEST_IDS.portalPayInvoice,
      MOCK_BILLING_TEST_IDS.portalPaymentMethod,
    ]);
  },
});

export const switchPlusInterval = scenarioAction({
  name: 'switchPlusInterval',
  act: async (s, actorId: string, priceKey: string) => {
    const catalogPriceId =
      PLUS_MEMBERSHIP_OFFER.prices[
        priceKey as keyof typeof PLUS_MEMBERSHIP_OFFER.prices
      ]?.catalogPriceId ?? priceKey;
    await inPortal(s, actorId, [
      MOCK_BILLING_TEST_IDS.portalSwitchStart(catalogPriceId),
      MOCK_BILLING_TEST_IDS.portalSwitch(catalogPriceId),
    ]);
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
 * the session the app's own checkout would create, paid through the hosted
 * page's API. The lifecycle walk's `resubscribe` stimulus: a provider-side
 * step that works whatever screen the payer is on.
 */
export const checkoutPlusAtProvider = scenarioAction({
  name: 'checkoutPlusAtProvider',
  act: async (s, actorId: string) => {
    const accountId = await accountIdOf(s, actorId);
    if (accountId === null) return;
    const provider = billingProviders(s).checkout();
    const call = providerCall(provider);
    const spec =
      PLUS_MEMBERSHIP_OFFER.prices[PLUS_MEMBERSHIP_OFFER.defaultPriceKey];
    const prices = await call<MockList<MockPrice>>(
      'GET',
      `${MOCK_BILLING_PATHS.prices}?lookup_keys=${spec.catalogPriceId}`
    );
    const price = prices.data[0]?.id ?? '';
    const session = await call<MockCheckoutSession>(
      'POST',
      MOCK_BILLING_PATHS.checkoutSessions,
      {
        mode: 'subscription',
        customer: await customerOf(s, accountId, provider),
        line_items: [{ price, quantity: 1 }],
        success_url: `${HARNESS_SERVER_URL}${PLUS_MEMBERSHIP_OFFER.portal.defaultReturnUrlPath}`,
        cancel_url: `${HARNESS_SERVER_URL}${PLUS_MEMBERSHIP_OFFER.portal.defaultReturnUrlPath}`,
        subscription_data: {
          metadata: { accountId },
          trial_period_days: spec.trialPeriodDays,
        },
      }
    );
    await call('POST', MOCK_BILLING_PAGE_API.checkoutConfirm(session.id), {
      price,
      paymentMethod: MOCK_TEST_PAYMENT_METHODS.visa,
    });
    await s.session.waitForIdle();
  },
});

/**
 * The harness's payment providers, by the id the app knows each by. The first is
 * the one every harness boots with; the second boots the first time the team
 * switches payment provider to it.
 */
export const FIRST_PAYMENT_PROVIDER = HARNESS_FIRST_BILLING_PROVIDER;
export const SECOND_PAYMENT_PROVIDER = 'mock-second';

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

/** Registered on every system that composes this feature. */
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
