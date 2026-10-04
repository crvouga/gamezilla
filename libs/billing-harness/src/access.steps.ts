/**
 * Billing access steps: subscribing, what tier a person has, and what the
 * billing screen offers them. Each step is one harness call or a fixed short
 * sequence.
 */

import { expect } from 'bun:test';
import { spawnActor } from '@libs/harness/actions';
import {
  signInWithGoogle,
  signInWithGoogleAsAccount,
} from '@libs/harness/auth-actions';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { focusActor } from '@libs/harness/shell-actions';
import type { HarnessWorld } from '@libs/harness/spec-world';
import { leaveCheckout, openBilling, subscribeToPlus } from './billing-actions';
import {
  billingButtonVisible,
  billingNotice,
  billingTier,
} from './billing-reads';

/** A settled tier lands a few virtual seconds after a write. */
const SETTLE_MS = 6_000;
const TIER_WAIT = { maxMs: 20_000, stepMs: 500 } as const;

async function subscribe(w: HarnessWorld, actor: Actor): Promise<void> {
  await w.s.apply(openBilling, actor);
  await w.s.apply(subscribeToPlus, actor);
}

/** The tier the billing screen on `device` shows, once it reads `tier`. */
async function expectTier(
  w: HarnessWorld,
  device: Actor,
  tier: 'free' | 'paid'
): Promise<void> {
  await w.s.apply(focusActor, device);
  await w.s.until((harness) => billingTier(harness, device), {
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
  await w.s.apply(openBilling, actor);
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
    await w.s.until(
      (harness) => billingButtonVisible(harness, actor, 'manage'),
      {
        ...TIER_WAIT,
        pred: (offered) => offered,
      }
    );
  }
);

Then('{actor} is offered to subscribe', async (w, actor: Actor) => {
  await w.s.until(
    (harness) => billingButtonVisible(harness, actor, 'subscribe'),
    {
      ...TIER_WAIT,
      pred: (offered) => offered,
    }
  );
});

Then('{actor} is not offered to subscribe', async (w, actor: Actor) => {
  expect(await w.s.read(billingButtonVisible, actor, 'subscribe')).toBe(false);
});

Then(
  '{actor} is told subscribing needs a connection',
  async (w, actor: Actor) => {
    await w.s.until((harness) => billingNotice(harness, actor), {
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
