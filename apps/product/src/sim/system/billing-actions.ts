/**
 * Product scenario actions for the plus membership. `observeMembership` is the
 * lifecycle driver at every fidelity: it posts one of the mock provider's
 * `observe` kinds, which derives the next membership from the account's current
 * projection row.
 */
import { SIM_SERVER_URL } from '@apps/server/sim/migrate-sim-postgres';
import { MOCK_BILLING_TEST_IDS } from '@libs/billing/public/mock-test-ids';
import { Handles } from '@libs/test-ids';
import type { SimPortalIntent } from '../fabric/sim-billing-browser';
import { actorUi, pollUntil, scenarioAction } from './actor-ui';
import { accountIdOf } from './billing-reads';

import { nodeText } from './observations';
import { type ProductSim, productExtra } from './sim';

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

/** Subscribe to plus, then wait for the tier to read `paid`. */
export const subscribeToPlus = scenarioAction({
  name: 'subscribeToPlus',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.billingSubscribe).tap({ timeoutMs: WAIT_MS });
    if (productExtra(s).ui.kind === 'bun-webview') {
      await ui
        .get(MOCK_BILLING_TEST_IDS.checkoutPay)
        .tap({ timeoutMs: WAIT_MS });
    }
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
  },
});

/** Queue a portal intent, open the portal, then press it where a browser must. */
async function applyPortalIntent(
  s: ProductSim,
  actorId: string,
  intent: SimPortalIntent,
  liveButtonTestId: string
): Promise<void> {
  const ui = await actorUi(s, actorId);
  s.sim.billingBrowser(actorId).queuePortalIntent(intent);
  await ui.get(Handles.billingManage).tap({ timeoutMs: WAIT_MS });
  if (productExtra(s).ui.kind === 'bun-webview') {
    await ui.get(liveButtonTestId).tap({ timeoutMs: WAIT_MS });
  }
  await ui.get(Handles.billingScreen).expect.visible({ timeoutMs: WAIT_MS });
}

export const cancelPlus = scenarioAction({
  name: 'cancelPlus',
  act: async (s, actorId: string) => {
    await applyPortalIntent(
      s,
      actorId,
      { kind: 'cancel' },
      MOCK_BILLING_TEST_IDS.portalCancel
    );
  },
});

export const resumePlus = scenarioAction({
  name: 'resumePlus',
  act: async (s, actorId: string) => {
    await applyPortalIntent(
      s,
      actorId,
      { kind: 'resume' },
      MOCK_BILLING_TEST_IDS.portalResume
    );
  },
});

export const switchPlusInterval = scenarioAction({
  name: 'switchPlusInterval',
  act: async (s, actorId: string, priceKey: string) => {
    await applyPortalIntent(
      s,
      actorId,
      { kind: 'switch_price', priceKey },
      MOCK_BILLING_TEST_IDS.portalSwitch(priceKey)
    );
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
 * Start a fresh checkout straight through the mock provider's checkout route —
 * the same edge the browser page posts to. Used where the billing screen
 * deliberately hides Subscribe (an ended membership still inside grace).
 */
export const checkoutPlusAtProvider = scenarioAction({
  name: 'checkoutPlusAtProvider',
  act: async (s, actorId: string) => {
    const accountId = await accountIdOf(s, actorId);
    if (accountId === null) return;
    const fetchFn = s.sim.loadBalancer.fetchFrom(actorId);
    const res = await fetchFn(`${SIM_SERVER_URL}/api/billing/mock/checkout`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        accountId,
        returnUrl: `${SIM_SERVER_URL}/more/billing`,
        action: 'pay',
      }).toString(),
    });
    // The mock edge answers 303 back to the return url on success.
    if (res.status >= 400) {
      throw new Error(`checkoutPlusAtProvider failed (${String(res.status)})`);
    }
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
