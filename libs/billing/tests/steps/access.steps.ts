/**
 * Billing access steps: subscribing, what tier a person has, and what the
 * billing screen offers them. Each step is one sim call or a fixed short
 * sequence.
 */

import { expect } from 'bun:test';

import {
  leaveCheckout,
  openBilling,
  subscribeToPlus,
} from '@libs/billing/sim/billing-actions';
import {
  billingButtonVisible,
  billingNotice,
  billingTier,
} from '@libs/billing/sim/billing-reads';
import {
  focusActor,
  signInWithGoogle,
  signInWithGoogleAsAccount,
  spawnActor,
} from '@libs/sim-harness';
import {
  type Actor,
  Given,
  type SimWorld,
  Then,
  When,
} from '@libs/sim-harness/spec/define';

/** A settled tier lands a few virtual seconds after a write. */
const SETTLE_MS = 6_000;
const TIER_WAIT = { maxMs: 20_000, stepMs: 500 } as const;

async function subscribe(w: SimWorld, actor: Actor): Promise<void> {
  await w.s.apply(openBilling, actor);
  await w.s.apply(subscribeToPlus, actor);
}

/** The tier the billing screen on `device` shows, once it reads `tier`. */
async function expectTier(
  w: SimWorld,
  device: Actor,
  tier: 'free' | 'paid'
): Promise<void> {
  await w.s.apply(focusActor, device);
  await w.s.until((sim) => billingTier(sim, device), {
    ...TIER_WAIT,
    pred: (shown) => shown === tier,
  });
}

Given('{actor} has subscribed to Plus', async (w, actor: Actor) => {
  await w.s.apply(signInWithGoogle, actor);
  await subscribe(w, actor);
});

When('{actor} subscribes to Plus', async (w, actor: Actor) => {
  await subscribe(w, actor);
});

When('{actor} views the billing plans', async (w, actor: Actor) => {
  await w.s.apply(openBilling, actor);
});

When(
  "{actor} signs in with Google on {actor}'s device",
  async (w, person: Actor, device: Actor) => {
    // The person has their own device, and with it their Google account.
    await w.s.apply(spawnActor, person);
    await w.s.apply(signInWithGoogleAsAccount, device, person);
  }
);

Then('{actor} has free access', async (w, actor: Actor) => {
  await expectTier(w, actor, 'free');
});

Then(
  "{actor} has free access on {actor}'s device",
  async (w, _person: Actor, device: Actor) => {
    await w.s.apply(openBilling, device);
    await expectTier(w, device, 'free');
  }
);

Then('{actor} has paid access', async (w, actor: Actor) => {
  // Settle first so a tier that is about to lapse is caught, not raced.
  await w.s.advanceTime(SETTLE_MS);
  await expectTier(w, actor, 'paid');
});

When('{actor} leaves checkout without paying', async (w, actor: Actor) => {
  await w.s.apply(openBilling, actor);
  await w.s.apply(leaveCheckout, actor);
});

Then(
  '{actor} is offered to manage their membership',
  async (w, actor: Actor) => {
    await w.s.until((sim) => billingButtonVisible(sim, actor, 'manage'), {
      ...TIER_WAIT,
      pred: (offered) => offered,
    });
  }
);

Then('{actor} is offered to subscribe', async (w, actor: Actor) => {
  await w.s.until((sim) => billingButtonVisible(sim, actor, 'subscribe'), {
    ...TIER_WAIT,
    pred: (offered) => offered,
  });
});

Then('{actor} is not offered to subscribe', async (w, actor: Actor) => {
  expect(await w.s.read(billingButtonVisible, actor, 'subscribe')).toBe(false);
});

Then(
  '{actor} is told subscribing needs a connection',
  async (w, actor: Actor) => {
    await w.s.until((sim) => billingNotice(sim, actor), {
      ...TIER_WAIT,
      pred: (notice) => notice === 'offline',
    });
  }
);

Then(
  '{actor} is asked to sign in before subscribing',
  async (w, actor: Actor) => {
    expect(await w.s.read(billingButtonVisible, actor, 'unlock')).toBe(true);
  }
);
