/**
 * Switching payment provider: the team moves new memberships to another
 * payment provider (or back), and whose billing portal a person's membership
 * is managed at.
 */

import { expect } from 'bun:test';

import {
  FIRST_PAYMENT_PROVIDER,
  managePlus,
  observeMembership,
  openBilling,
  SECOND_PAYMENT_PROVIDER,
  subscribeToPlus,
  switchPaymentProvider,
} from '@libs/billing/harness/billing-actions';
import {
  checkoutProvider,
  membershipShown,
  providerPageShown,
} from '@libs/billing/harness/billing-reads';
import { signInWithGoogle } from '@libs/harness';
import {
  type Actor,
  Given,
  type HarnessWorld,
  Then,
  When,
} from '@libs/harness/spec/define';
import { accountIdOf } from '@libs/harness/system/identity';

const SHOWN_WAIT = { maxMs: 60_000, stepMs: 1_000 } as const;

/** The team moves new memberships to the provider they are not at now. */
async function switchProvider(w: HarnessWorld): Promise<void> {
  const now = await w.s.read(checkoutProvider);
  await w.s.apply(
    switchPaymentProvider,
    now === FIRST_PAYMENT_PROVIDER
      ? SECOND_PAYMENT_PROVIDER
      : FIRST_PAYMENT_PROVIDER
  );
}

async function subscribe(w: HarnessWorld, actor: Actor): Promise<void> {
  if ((await w.s.read(accountIdOf, actor)) === null) {
    await w.s.apply(signInWithGoogle, actor);
  }
  await w.s.apply(openBilling, actor);
  await w.s.apply(subscribeToPlus, actor);
}

/** End the actor's membership at once, and see it ended. */
async function endMembership(w: HarnessWorld, actor: Actor): Promise<void> {
  await w.s.apply(observeMembership, actor, 'cancel_now');
  await w.s.until((harness) => membershipShown(harness, actor), {
    ...SHOWN_WAIT,
    pred: (shown) => shown?.state === 'ended',
  });
}

async function expectPortalAt(
  w: HarnessWorld,
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
  "{actor}'s memberships have ended at both payment providers",
  async (w, actor: Actor) => {
    await subscribe(w, actor);
    await endMembership(w, actor);
    await w.s.apply(switchPaymentProvider, SECOND_PAYMENT_PROVIDER);
    await subscribe(w, actor);
    await endMembership(w, actor);
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
