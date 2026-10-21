/**
 * Checkout as a person meets it more than once: opening the provider's
 * checkout and going back from it, paying while the provider's word has not
 * reached the app yet, and pressing subscribe again. The reads say what the
 * provider holds for the person: whether a checkout can still take a
 * payment, and how many memberships they are charged for.
 */

import { letTimePass } from '@libs/harness-ts/actions';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { HARNESS_LOAD_BALANCER_ID } from '@libs/harness-ts/load-balancer';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { membershipStatusOf } from '@pkgs/billing-stripe-shared-ts/membership-status';
import {
  BILLING_WAIT_MS,
  payOnCheckoutPage,
  pressBillingButton,
  STRIPE_PAGE,
} from './billing-gestures';
import {
  billingProviders,
  customerAt,
  subscriptionsEverywhere,
} from './billing-provider-driver';
import {
  billingButtonEnabled,
  billingButtonVisible,
  subscribeButtonPhase,
} from './billing-reads';

/** Whether the actor is looking at a provider checkout that takes a card. */
export async function onCheckout(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  const ui = await actorUi(s, actorId);
  return await ui.get(STRIPE_PAGE.checkoutCard).isVisible();
}

/**
 * The account's newest checkout that can still take a payment, at the
 * provider new checkouts go to — as a tester sees it on the provider's
 * dashboard — or `null` when none is open.
 */
export async function newestOpenCheckout(
  s: ProductHarness,
  accountId: string
): Promise<string | null> {
  const provider = billingProviders(s).checkout();
  const customer = await customerAt(s, accountId, provider);
  if (customer === null) return null;
  const open = await provider.stripe.checkout.sessions.list({
    customer,
    status: 'open',
    limit: 100,
  });
  const newest = [...open.data].sort((a, b) => b.created - a.created)[0];
  return newest?.id ?? null;
}

async function backOnBilling(s: ProductHarness, actorId: string) {
  const ui = await actorUi(s, actorId);
  await ui
    .get(Handles.billingScreen)
    .expect.visible({ timeoutMs: BILLING_WAIT_MS });
}

/** Press subscribe and wait for the provider's checkout to open. */
export const openCheckout = scenarioAction({
  name: 'openCheckout',
  act: async (s, actorId: string) => {
    await pressBillingButton(s, actorId, 'subscribe');
    await pollUntil(
      s,
      async () => ((await onCheckout(s, actorId)) ? true : null),
      { maxMs: BILLING_WAIT_MS, description: 'the provider checkout to open' }
    );
  },
});

/** On an open checkout: take its own back link to the billing screen. */
export const goBackFromCheckout = scenarioAction({
  name: 'goBackFromCheckout',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui
      .get(STRIPE_PAGE.checkoutCancel)
      .tap({ timeoutMs: BILLING_WAIT_MS });
    await backOnBilling(s, actorId);
  },
});

/**
 * Pay at checkout while news from the provider cannot reach the app: its
 * webhooks to the API are held (they retry), so the payment is taken but the
 * app has not heard of it. The checkout returns to the billing screen.
 */
export const payAtCheckoutUnconfirmed = scenarioAction({
  name: 'payAtCheckoutUnconfirmed',
  act: async (s, actorId: string) => {
    const provider = billingProviders(s).checkout();
    s.harness.partition(provider.netNode, HARNESS_LOAD_BALANCER_ID);
    await pressBillingButton(s, actorId, 'subscribe');
    await payOnCheckoutPage(s, actorId);
    await backOnBilling(s, actorId);
  },
});

/** How long a person waits, at most, for the screen to offer subscribe again. */
const SUBSCRIBE_AGAIN_PATIENCE_MS = 5 * 60_000;
const SUBSCRIBE_AGAIN_HOP_MS = 30_000;

/**
 * Wait, as a person does, while the billing screen is confirming a payment
 * and offers no subscribe button: once the confirmation window passes, the
 * screen offers subscribing again (warning to check first).
 */
async function waitForSubscribeOffer(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  for (
    let waitedMs = 0;
    waitedMs < SUBSCRIBE_AGAIN_PATIENCE_MS;
    waitedMs += SUBSCRIBE_AGAIN_HOP_MS
  ) {
    if (await billingButtonEnabled(s, actorId, 'subscribe')) return;
    if (await billingButtonVisible(s, actorId, 'manage')) return;
    await Promise.resolve(letTimePass.act(s, SUBSCRIBE_AGAIN_HOP_MS));
  }
}

/**
 * Press subscribe again, as a person unsure the first payment went through
 * does: wait for the screen to offer it, then when the app opens a checkout,
 * pay it with the working card; when it refuses, the button says it could
 * not open one (or the app, having learned of the membership meanwhile,
 * offers to manage it).
 */
export const trySubscribingAgain = scenarioAction({
  name: 'trySubscribingAgain',
  act: async (s, actorId: string) => {
    await waitForSubscribeOffer(s, actorId);
    if (await billingButtonVisible(s, actorId, 'manage')) return;
    await pressBillingButton(s, actorId, 'subscribe');
    const outcome = await pollUntil(
      s,
      async () => {
        if (await onCheckout(s, actorId)) return 'checkout';
        // Refused: the button says it could not open a checkout, or the app
        // has meanwhile learned of the membership and offers to manage it.
        if ((await subscribeButtonPhase(s, actorId)) === 'error') {
          return 'refused';
        }
        return (await billingButtonVisible(s, actorId, 'manage'))
          ? 'refused'
          : null;
      },
      {
        maxMs: BILLING_WAIT_MS,
        description: 'a checkout to open or subscribing to be refused',
      }
    );
    if (outcome === 'refused') return;
    await payOnCheckoutPage(s, actorId);
    await backOnBilling(s, actorId);
  },
});

/** Whether the provider checkout `checkoutId` can still take a payment. */
export async function checkoutTakesPayment(
  s: ProductHarness,
  checkoutId: string
): Promise<boolean> {
  for (const provider of billingProviders(s).all()) {
    const found = await provider.stripe.checkout.sessions
      .retrieve(checkoutId)
      .catch(() => null);
    if (found !== null) return found.status === 'open';
  }
  throw new Error(`billing: no provider holds checkout ${checkoutId}`);
}

/**
 * How many memberships the providers are charging the account for: every
 * subscription, at any provider, that has not ended.
 */
export async function membershipsCharged(
  s: ProductHarness,
  accountId: string
): Promise<number> {
  const everywhere = await subscriptionsEverywhere(s, accountId);
  return everywhere
    .flatMap((at) => at.subscriptions)
    .filter((sub) => membershipStatusOf(sub.status) !== 'ended').length;
}

export const CHECKOUT_HARNESS_ACTIONS = [
  openCheckout,
  goBackFromCheckout,
  payAtCheckoutUnconfirmed,
  trySubscribingAgain,
];
