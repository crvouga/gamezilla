/**
 * Switching payment provider: the team moves new memberships to another
 * payment provider (or back), a provider repeats its earlier news, and whose
 * billing portal a person's membership is managed at.
 */

import { expect } from 'bun:test';

import {
  FIRST_PAYMENT_PROVIDER,
  managePlus,
  observeMembership,
  openBilling,
  repeatProviderNews,
  SECOND_PAYMENT_PROVIDER,
  subscribeToPlus,
  switchPaymentProvider,
} from '@libs/billing/sim/billing-actions';
import {
  checkoutProvider,
  membershipShown,
  providerPageShown,
} from '@libs/billing/sim/billing-reads';
import { signInWithGoogle } from '@libs/sim-harness';
import {
  type Actor,
  Given,
  type SimWorld,
  Then,
  When,
} from '@libs/sim-harness/spec/define';
import { accountIdOf } from '@libs/sim-harness/system/identity';

const SHOWN_WAIT = { maxMs: 60_000, stepMs: 1_000 } as const;

/** The team moves new memberships to the provider they are not at now. */
async function switchProvider(w: SimWorld): Promise<void> {
  const now = await w.s.read(checkoutProvider);
  await w.s.apply(
    switchPaymentProvider,
    now === FIRST_PAYMENT_PROVIDER
      ? SECOND_PAYMENT_PROVIDER
      : FIRST_PAYMENT_PROVIDER
  );
}

async function subscribe(w: SimWorld, actor: Actor): Promise<void> {
  if ((await w.s.read(accountIdOf, actor)) === null) {
    await w.s.apply(signInWithGoogle, actor);
  }
  await w.s.apply(openBilling, actor);
  await w.s.apply(subscribeToPlus, actor);
}

/** End the actor's membership at once, and see it ended. */
async function endMembership(w: SimWorld, actor: Actor): Promise<void> {
  await w.s.apply(observeMembership, actor, 'cancel_now');
  await w.s.until((sim) => membershipShown(sim, actor), {
    ...SHOWN_WAIT,
    pred: (shown) => shown?.state === 'ended',
  });
}

async function expectPortalAt(
  w: SimWorld,
  actor: Actor,
  provider: string
): Promise<void> {
  await w.s.apply(managePlus, actor);
  expect(await w.s.read(providerPageShown, actor)).toBe(provider);
}

When('the team switches payment provider', async (w) => {
  await switchProvider(w);
});

Given('the team has switched payment provider', async (w) => {
  await switchProvider(w);
});

Given('the team has switched back to the first payment provider', async (w) => {
  await w.s.apply(switchPaymentProvider, FIRST_PAYMENT_PROVIDER);
});

Given(
  '{actor} has subscribed to Plus at the second payment provider',
  async (w, actor: Actor) => {
    await w.s.apply(switchPaymentProvider, SECOND_PAYMENT_PROVIDER);
    await subscribe(w, actor);
  }
);

Given(
  "{actor}'s memberships have ended at both payment providers",
  async (w, actor: Actor) => {
    await subscribe(w, actor);
    await endMembership(w, actor);
    await w.s.apply(switchPaymentProvider, SECOND_PAYMENT_PROVIDER);
    await subscribe(w, actor);
    await endMembership(w, actor);
  }
);

When(
  "the first payment provider repeats its news that {actor}'s membership ended",
  async (w, actor: Actor) => {
    await w.s.apply(repeatProviderNews, actor, FIRST_PAYMENT_PROVIDER, {
      ended: true,
    });
  }
);

Then(
  "{actor}'s billing portal is the first payment provider's",
  async (w, actor: Actor) => {
    await expectPortalAt(w, actor, FIRST_PAYMENT_PROVIDER);
  }
);

Then(
  "{actor}'s billing portal is the second payment provider's",
  async (w, actor: Actor) => {
    await expectPortalAt(w, actor, SECOND_PAYMENT_PROVIDER);
  }
);
