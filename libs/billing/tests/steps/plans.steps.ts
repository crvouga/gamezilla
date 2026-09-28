/**
 * What the billing plans tell a person: each plan's price, the free trial
 * offered and the one under way, which plan is their current one, and a
 * failed payment with the way to pay again. Each step is one harness call or
 * a fixed short sequence.
 */

import { expect } from 'bun:test';

import {
  runFreeTrialToDaysLeft,
  switchPlusInterval,
} from '@libs/billing/harness/billing-actions';
import {
  freeTrialEndDay,
  freeTrialOffered,
  freeTrialShown,
  offeredNewCard,
  type PlanShown,
  planShown,
} from '@libs/billing/harness/billing-plans-reads';
import { billingNotice } from '@libs/billing/harness/billing-reads';
import {
  type Actor,
  Given,
  type HarnessWorld,
  Then,
} from '@libs/harness/spec/define';

const MONTHLY = 'subscription_monthly';
const YEARLY = 'subscription_yearly';
/** Provider news reaches the device's screen within a few virtual seconds. */
const SHOWN_WAIT = { maxMs: 60_000, stepMs: 1_000 } as const;

/** The plan once the billing plans show it as `match` wants. */
async function planWhere(
  w: HarnessWorld,
  actor: Actor,
  priceKey: string,
  match: (plan: PlanShown) => boolean
): Promise<PlanShown | null> {
  return await w.s.until((harness) => planShown(harness, actor, priceKey), {
    ...SHOWN_WAIT,
    pred: (plan) => plan !== null && match(plan),
  });
}

// ------------------------------------------------------------ state

Given(
  '{actor} has {int} days left in the free trial',
  async (w, actor: Actor, days: number) => {
    await w.s.apply(runFreeTrialToDaysLeft, actor, days);
  }
);

Given(
  '{actor} has switched the membership to the yearly plan in the billing portal',
  async (w, actor: Actor) => {
    await w.s.apply(switchPlusInterval, actor, YEARLY);
  }
);

// ------------------------------------------------------------ prices

Then(
  '{actor} sees the monthly plan at {word} a month',
  async (w, actor: Actor, amount: string) => {
    const plan = await planWhere(w, actor, MONTHLY, () => true);
    expect(plan).toMatchObject({ amount, per: 'month' });
  }
);

Then(
  '{actor} sees the yearly plan at {word} a year, {word} a month, saving {int}%',
  async (w, actor: Actor, ...shown: [string, string, number]) => {
    const [amount, perMonth, savingPercent] = shown;
    const plan = await planWhere(w, actor, YEARLY, () => true);
    expect(plan).toMatchObject({
      amount,
      per: 'year',
      perMonth,
      savingPercent,
    });
  }
);

Then(
  '{actor} is offered a {int}-day free trial',
  async (w, actor: Actor, days: number) => {
    expect(await w.s.read(freeTrialOffered, actor)).toBe(days);
  }
);

// ------------------------------------------------------------ the free trial

Then(
  '{actor} sees their free trial ends in {int} days',
  async (w, actor: Actor, days: number) => {
    await w.s.until((harness) => freeTrialShown(harness, actor), {
      ...SHOWN_WAIT,
      pred: (trial) => trial?.daysLeft === days,
    });
  }
);

Then('{actor} sees the day their free trial ends', async (w, actor: Actor) => {
  const trial = await w.s.read(freeTrialShown, actor);
  expect(trial?.endsOn ?? null).not.toBeNull();
  expect(trial?.endsOn).toBe(await w.s.read(freeTrialEndDay, actor));
});

// ------------------------------------------------------------ current plan

Then(
  '{actor} sees the monthly plan marked as their current plan',
  async (w, actor: Actor) => {
    await planWhere(w, actor, MONTHLY, (plan) => plan.current);
  }
);

Then(
  '{actor} sees the yearly plan marked as their current plan',
  async (w, actor: Actor) => {
    await planWhere(w, actor, YEARLY, (plan) => plan.current);
  }
);

Then(
  '{actor} sees the monthly plan not marked as their current plan',
  async (w, actor: Actor) => {
    expect(await w.s.read(planShown, actor, MONTHLY)).toMatchObject({
      current: false,
    });
  }
);

Then(
  '{actor} sees the yearly plan not marked as their current plan',
  async (w, actor: Actor) => {
    expect(await w.s.read(planShown, actor, YEARLY)).toMatchObject({
      current: false,
    });
  }
);

// ------------------------------------------------------------ failed payment

Then('{actor} is told their payment failed', async (w, actor: Actor) => {
  await w.s.until((harness) => billingNotice(harness, actor), {
    ...SHOWN_WAIT,
    pred: (notice) => notice === 'delinquent',
  });
});

Then('{actor} is not told a payment failed', async (w, actor: Actor) => {
  expect(await w.s.read(billingNotice, actor)).not.toBe('delinquent');
});

Then('{actor} is offered to pay with a new card', async (w, actor: Actor) => {
  expect(await w.s.read(offeredNewCard, actor)).toBe(true);
});

Then(
  '{actor} is not offered to pay with a new card',
  async (w, actor: Actor) => {
    expect(await w.s.read(offeredNewCard, actor)).toBe(false);
  }
);
