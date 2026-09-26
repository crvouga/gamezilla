/**
 * Billing access steps: subscribing, what tier a person has, what the billing
 * screen offers them, and whether the server agrees with their device. Each
 * step is one sim call or a fixed short sequence.
 */

import { expect } from 'bun:test';

import {
  openBilling,
  subscribeToPlus,
} from '@libs/billing/sim/billing-actions';
import {
  billingButtonVisible,
  billingTier,
  membershipRow,
  serverMembershipCount,
  serverMembershipRow,
} from '@libs/billing/sim/billing-reads';
import { accountIdOf, focusActor, signInWithGoogle } from '@libs/sim-harness';
import {
  type Actor,
  Given,
  type SimWorld,
  Then,
  When,
} from '@libs/sim-harness/spec/define';

/** Synced rows and a settled tier land a few virtual seconds after a write. */
const SETTLE_MS = 6_000;
const TIER_WAIT = { maxMs: 20_000, stepMs: 500 } as const;

async function accountId(w: SimWorld, actor: Actor): Promise<string> {
  const id = await w.s.read(accountIdOf, actor);
  if (id === null) throw new Error(`${actor} has no signed-in account`);
  return id;
}

async function subscribe(w: SimWorld, actor: Actor): Promise<void> {
  await w.s.apply(openBilling, actor);
  await w.s.apply(subscribeToPlus, actor);
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

Then('{actor} has free access', async (w, actor: Actor) => {
  await w.s.apply(focusActor, actor);
  await w.s.until((sim) => billingTier(sim, actor), {
    ...TIER_WAIT,
    pred: (tier) => tier === 'free',
  });
});

Then('{actor} has paid access', async (w, actor: Actor) => {
  // Settle first so a tier that is about to lapse is caught, not raced.
  await w.s.advanceTime(SETTLE_MS);
  await w.s.apply(focusActor, actor);
  await w.s.until((sim) => billingTier(sim, actor), {
    ...TIER_WAIT,
    pred: (tier) => tier === 'paid',
  });
});

Then('{actor} is offered the unlock', async (w, actor: Actor) => {
  expect(await w.s.read(billingButtonVisible, actor, 'unlock')).toBe(true);
});

Then(
  "the server's copy of {actor}'s membership matches {actor}'s device",
  async (w, owner: Actor, device: Actor) => {
    const local = await w.s.read(membershipRow, device);
    if (local === null) throw new Error(`${device}'s device has no membership`);
    const server = await w.s.read(
      serverMembershipRow,
      await accountId(w, owner)
    );
    expect(server?.status).toBe(local.status);
    expect(server?.price_key).toBe(local.price_key);
  }
);

Then(
  "the server records {actor}'s membership as delinquent",
  async (w, actor: Actor) => {
    const server = await w.s.read(
      serverMembershipRow,
      await accountId(w, actor)
    );
    expect(server?.status).toBe('delinquent');
  }
);

Then('the server holds exactly one membership', async (w) => {
  expect(await w.s.read(serverMembershipCount)).toBe(1);
});
