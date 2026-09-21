/**
 * Product scenario actions for the plus membership. `observeMembership` is the
 * lifecycle driver at every fidelity: it posts one of the mock provider's
 * `observe` kinds, which derives the next membership from the account's current
 * projection row.
 */

import { createMockBillingApi } from '@libs/billing/public/mock-billing-api';
import { MOCK_BILLING_TEST_IDS } from '@libs/billing/public/mock-test-ids';
import { SIM_SERVER_URL } from '@libs/server-app/sim/migrate-sim-postgres';
import { Handles } from '@libs/test-ids';
import { actorUi, pollUntil, scenarioAction } from './actor-ui';
import { accountIdOf } from './identity';

import { nodeText } from './observations';
import type { ProductSim } from './sim';

const WAIT_MS = 20_000;

export const BILLING_OBSERVE_KINDS = [
  'period_end',
  'payment_failed',
  'payment_recovered',
  'cancel_at_period_end',
  'resume',
  'cancel_now',
  'switch_interval',
  'payment_incomplete',
  'payment_expired',
] as const;

export type BillingObserveKind = (typeof BILLING_OBSERVE_KINDS)[number];

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
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.billingSubscribe).tap({ timeoutMs: WAIT_MS });
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
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.billingManage).tap({ timeoutMs: WAIT_MS });
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
  const ui = await actorUi(s, actorId);
  await ui.get(Handles.billingManage).tap({ timeoutMs: WAIT_MS });
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
    await inPortal(s, actorId, [MOCK_BILLING_TEST_IDS.portalResume]);
  },
});

export const switchPlusInterval = scenarioAction({
  name: 'switchPlusInterval',
  act: async (s, actorId: string, priceKey: string) => {
    await inPortal(s, actorId, [
      MOCK_BILLING_TEST_IDS.portalSwitchStart(priceKey),
      MOCK_BILLING_TEST_IDS.portalSwitch(priceKey),
    ]);
  },
});

/**
 * Drive one lifecycle transition through the mock provider's `observe` route.
 * Guests (no signed-in account) have nothing to observe.
 */
export const observeMembership = scenarioAction({
  name: 'observeMembership',
  act: async (s, actorId: string, kind: BillingObserveKind) => {
    const accountId = await accountIdOf(s, actorId);
    if (accountId === null) return;
    const fetchFn = s.sim.loadBalancer.fetchFrom(actorId);
    const res = await fetchFn(`${SIM_SERVER_URL}/api/billing/mock/observe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ accountId, kind }),
    });
    if (!res.ok) {
      throw new Error(
        `observeMembership ${kind} failed (${String(res.status)})`
      );
    }
    await s.session.waitForIdle();
  },
});

/**
 * Start a fresh checkout straight through the mock provider's API — the same
 * call its checkout page makes on "Start free trial". Used where the billing
 * screen deliberately hides Subscribe (an ended membership still inside grace).
 */
export const checkoutPlusAtProvider = scenarioAction({
  name: 'checkoutPlusAtProvider',
  act: async (s, actorId: string) => {
    const accountId = await accountIdOf(s, actorId);
    if (accountId === null) return;
    const api = createMockBillingApi({
      fetch: s.sim.loadBalancer.fetchFrom(actorId),
      baseUrl: `${SIM_SERVER_URL}/api/billing/mock/`,
    });
    const state = await api.state(accountId);
    await api.checkout({ accountId, priceKey: state.defaultPriceKey });
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
