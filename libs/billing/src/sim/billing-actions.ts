/**
 * Product scenario actions for the plus membership. A person acts in the app
 * and on the provider's hosted pages; `observeMembership` is the tester acting
 * at the provider (test clocks, test cards, subscription updates), whose
 * effect reaches the app only as a signed webhook.
 */

import { SIM_SERVER_URL } from '@libs/feature/public/sim-constants';
import {
  actorUi,
  pollUntil,
  scenarioAction,
} from '@libs/sim-harness/system/actor-ui';
import { accountIdOf } from '@libs/sim-harness/system/identity';
import { nodeText } from '@libs/sim-harness/system/observations';
import type { ProductSim } from '@libs/sim-harness/system/sim';
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
  customerOf,
  driveProvider,
  providerCall,
} from './billing-provider-driver';
import { billingButtonEnabled } from './billing-reads';

export {
  BILLING_OBSERVE_KINDS,
  type BillingObserveKind,
} from './billing-provider-driver';

const WAIT_MS = 20_000;

/**
 * Press one of the billing screen's own buttons once it accepts a press. Each
 * stays disabled on its "Opening…" face for a moment after it opened the
 * provider's page, and a press on a disabled button does nothing, so a person
 * back from the provider waits for it, as this does.
 */
async function pressBillingButton(
  s: ProductSim,
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
  s: ProductSim,
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
    const call = providerCall(s);
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
        customer: await customerOf(s, accountId),
        line_items: [{ price, quantity: 1 }],
        success_url: `${SIM_SERVER_URL}${PLUS_MEMBERSHIP_OFFER.portal.defaultReturnUrlPath}`,
        cancel_url: `${SIM_SERVER_URL}${PLUS_MEMBERSHIP_OFFER.portal.defaultReturnUrlPath}`,
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
export const BILLING_SIM_ACTIONS = [
  openBilling,
  subscribeToPlus,
  managePlus,
  cancelPlus,
  checkoutPlusAtProvider,
  resumePlus,
  switchPlusInterval,
  observeMembership,
  advanceBillingClock,
];
