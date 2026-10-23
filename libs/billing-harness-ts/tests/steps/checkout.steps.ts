/**
 * Checkout met more than once: going back from it and subscribing again,
 * and pressing subscribe again before the provider's word about a payment
 * has reached the app. Each is charged for one membership.
 */

import { expect } from 'bun:test';

import { openBilling } from '@libs/billing-harness-ts/billing-actions';
import {
  checkoutTakesPayment,
  goBackFromCheckout,
  membershipsCharged,
  newestOpenCheckout,
  openCheckout,
  payAtCheckoutUnconfirmed,
  trySubscribingAgain,
} from '@libs/billing-harness-ts/checkout-actions';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { Given, Then, When } from '@libs/harness-ts/define';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { recall, remember } from '@libs/harness-ts/spec-world';

/** Key of the checkout the actor went back from. */
const earlierCheckoutKey = (actor: Actor) =>
  `billing-earlier-checkout:${actor}`;

Given('{actor} has left checkout without paying', async (w, actor: Actor) => {
  await w.s.apply(openBilling, actor);
  await w.s.apply(openCheckout, actor);
  const accountId = await w.s.read(signedInAccountOf, actor);
  const checkout = await w.s.read(newestOpenCheckout, String(accountId));
  if (checkout === null) throw new Error(`${actor} has no open checkout`);
  remember(w, earlierCheckoutKey(actor), checkout);
  await w.s.apply(goBackFromCheckout, actor);
});

Given(
  '{actor} has paid at checkout and the payment provider has not yet confirmed it',
  async (w, actor: Actor) => {
    await w.s.apply(signInWithGoogle, actor);
    await w.s.apply(openBilling, actor);
    await w.s.apply(payAtCheckoutUnconfirmed, actor);
  }
);

When('{actor} tries to subscribe to Plus again', async (w, actor: Actor) => {
  await w.s.apply(trySubscribingAgain, actor);
});

Then(
  "{actor}'s earlier checkout can no longer take a payment",
  async (w, actor: Actor) => {
    const checkout = recall(w, earlierCheckoutKey(actor)) as string;
    expect(await w.s.read(checkoutTakesPayment, checkout)).toBe(false);
  }
);

Then('{actor} is charged for only one membership', async (w, actor: Actor) => {
  const accountId = await w.s.read(signedInAccountOf, actor);
  if (accountId === null) throw new Error(`${actor} is not signed in`);
  expect(await w.s.read(membershipsCharged, String(accountId))).toBe(1);
});
