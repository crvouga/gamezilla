/**
 * Membership lifecycle steps: what the provider does to a membership (period
 * ends, failed and recovered payments, cancellation, retries given up), what
 * the person does in the billing portal, and what their billing screen then
 * shows (state, plan, renewal date).
 */

import { expect } from 'bun:test';

import {
  cancelPlus,
  observeMembership,
  openBilling,
  payWithNewCard,
  providerEvent,
  resumePlus,
  switchPlusInterval,
} from '@libs/billing-harness-ts/billing-actions';
import type { BillingObserveKind } from '@libs/billing-harness-ts/billing-provider-driver';
import type { MembershipShown } from '@libs/billing-harness-ts/billing-reads';
import {
  currentPlan,
  membershipShown,
  serverMembershipRow,
} from '@libs/billing-harness-ts/billing-reads';
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing-shared-ts/plus-membership-offer';
import { letTimePass } from '@libs/harness-ts/actions';
import { Given, Step, Then, When } from '@libs/harness-ts/define';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { accountIdOf } from '@libs/harness-ts/identity';
import { nodeText } from '@libs/harness-ts/observations';
import type { Actor } from '@libs/harness-ts/parameter-types';
import type { HarnessWorld } from '@libs/harness-ts/spec-world';
import { recall, remember } from '@libs/harness-ts/spec-world';
import { Handles } from '@libs/test-ids-shared-ts/handles';

const MONTHLY = 'subscription_monthly';
const YEARLY = 'subscription_yearly';
const PLANS = [MONTHLY, YEARLY] as const;
/** Provider webhooks reach the device's screen within a few virtual seconds. */
const SHOWN_WAIT = { maxMs: 60_000, stepMs: 1_000 } as const;

/** Key of the renewal date the screen showed before the scenario's event. */
const renewalKey = (actor: Actor) => `billing-renewal-before:${actor}`;

/** Bring the billing screen into view if it is not already showing. */
async function onBilling(w: HarnessWorld, actor: Actor): Promise<void> {
  if ((await w.s.read(membershipShown, actor)) === null) {
    await w.s.apply(openBilling, actor);
  }
}

/** Wait until the actor's billing screen shows a membership matching `match`. */
async function shownWhere(
  w: HarnessWorld,
  actor: Actor,
  match: (shown: MembershipShown) => boolean
): Promise<MembershipShown> {
  await onBilling(w, actor);
  const shown = await w.s.until((harness) => membershipShown(harness, actor), {
    ...SHOWN_WAIT,
    pred: (candidate) => candidate !== null && match(candidate),
  });
  if (shown === null) throw new Error(`${actor}'s billing screen is not open`);
  return shown;
}

async function expectPlan(
  w: HarnessWorld,
  actor: Actor,
  plan: (typeof PLANS)[number]
): Promise<void> {
  await onBilling(w, actor);
  await w.s.until((harness) => currentPlan(harness, actor, PLANS), {
    ...SHOWN_WAIT,
    pred: (shown) => shown === plan,
  });
}

/** Remember the renewal date on screen before an event that should move it. */
async function rememberRenewal(w: HarnessWorld, actor: Actor): Promise<void> {
  const shown = await shownWhere(w, actor, (s) => s.periodEndMs !== null);
  remember(w, renewalKey(actor), shown.periodEndMs);
}

async function observe(
  w: HarnessWorld,
  actor: Actor,
  kind: BillingObserveKind
): Promise<void> {
  await w.s.apply(observeMembership, actor, kind);
}

// ------------------------------------------------------ provider lifecycle

When("{actor}'s billing period ends", async (w, actor: Actor) => {
  await rememberRenewal(w, actor);
  await observe(w, actor, 'period_end');
});

Given("{actor}'s free trial has ended", async (w, actor: Actor) => {
  await observe(w, actor, 'period_end');
  // "Has ended" is settled: the screen has left the trial behind.
  await shownWhere(
    w,
    actor,
    (shown) => shown.state !== 'trialing' && shown.state !== 'canceling'
  );
});

When("{actor}'s payment fails", async (w, actor: Actor) => {
  await observe(w, actor, 'payment_failed');
});

Given("{actor}'s payment has failed", async (w, actor: Actor) => {
  await observe(w, actor, 'payment_failed');
  await shownWhere(w, actor, (shown) => shown.state === 'delinquent');
});

When("{actor}'s payment recovers", async (w, actor: Actor) => {
  await observe(w, actor, 'payment_recovered');
});

When(
  "the payment provider gives up on {actor}'s payment",
  async (w, actor: Actor) => {
    await observe(w, actor, 'payment_retries_exhausted');
  }
);

When(
  "{actor}'s membership is canceled immediately",
  async (w, actor: Actor) => {
    await observe(w, actor, 'cancel_now');
  }
);

Given(
  "{actor}'s membership has been canceled immediately",
  async (w, actor: Actor) => {
    await observe(w, actor, 'cancel_now');
    await shownWhere(w, actor, (shown) => shown.state === 'ended');
  }
);

/** How long until the person's own clock reaches the membership's period end. */
async function untilPeriodEnd(
  s: ProductHarness,
  actor: Actor
): Promise<number> {
  const accountId = await accountIdOf(s, actor);
  if (accountId === null) return 0;
  const row = await serverMembershipRow(s, accountId);
  if (row?.current_period_end == null) return 0;
  const end = Date.parse(row.current_period_end);
  if (Number.isNaN(end)) return 0;
  return Math.max(0, end - s.session.ports.clock.now());
}

When("{actor}'s billing period has run out", async (w, actor: Actor) => {
  await w.s.apply(providerEvent, actor, 'run_out_period');
  // A provider clock that was already ahead stops short of the person's
  // own period end. Grace is counted on the person's clock.
  const gap = await w.s.read(untilPeriodEnd, actor);
  if (gap > 0) await w.s.apply(letTimePass, gap);
});

Given("{actor}'s billing period has ended", async (w, actor: Actor) => {
  const before = await shownWhere(w, actor, () => true);
  await w.s.apply(providerEvent, actor, 'run_out_period');
  // "Has ended" is settled: the screen has moved past the period it showed.
  await shownWhere(
    w,
    actor,
    (shown) =>
      shown.state !== before.state || shown.periodEndMs !== before.periodEndMs
  );
});

When("{actor}'s payment is refunded", async (w, actor: Actor) => {
  await w.s.apply(providerEvent, actor, 'refund');
});

Given("{actor}'s payment has been refunded", async (w, actor: Actor) => {
  await w.s.apply(providerEvent, actor, 'refund');
  await shownWhere(w, actor, (shown) => shown.state === 'ended');
});

Given("{actor}'s card has expired", async (w, actor: Actor) => {
  await w.s.apply(providerEvent, actor, 'expire_card');
});

Given(
  "{actor}'s renewal on the expired card has failed",
  async (w, actor: Actor) => {
    await observe(w, actor, 'period_end');
    await shownWhere(w, actor, (shown) => shown.state === 'delinquent');
  }
);

// ------------------------------------------------------ the billing portal

When(
  '{actor} pays with a new card in the billing portal',
  async (w, actor: Actor) => {
    await w.s.apply(payWithNewCard, actor);
  }
);

When(
  '{actor} cancels the membership in the billing portal',
  async (w, actor: Actor) => {
    await w.s.apply(cancelPlus, actor);
  }
);

Given(
  '{actor} has canceled the membership in the billing portal',
  async (w, actor: Actor) => {
    await w.s.apply(cancelPlus, actor);
    await shownWhere(w, actor, (shown) => shown.state === 'canceling');
  }
);

When(
  '{actor} renews the membership in the billing portal',
  async (w, actor: Actor) => {
    await w.s.apply(resumePlus, actor);
  }
);

When(
  '{actor} switches the membership to the yearly plan in the billing portal',
  async (w, actor: Actor) => {
    await rememberRenewal(w, actor);
    await w.s.apply(switchPlusInterval, actor, YEARLY);
  }
);

When(
  '{actor} switches the membership to the monthly plan in the billing portal',
  async (w, actor: Actor) => {
    await rememberRenewal(w, actor);
    await w.s.apply(switchPlusInterval, actor, MONTHLY);
  }
);

/** What the next renewal charges, once the screen marks a current plan. */
async function renewalCents(w: HarnessWorld, actor: Actor): Promise<number> {
  await onBilling(w, actor);
  const plan = await w.s.until(
    (harness) => currentPlan(harness, actor, PLANS),
    {
      ...SHOWN_WAIT,
      pred: (shown) => shown !== null,
    }
  );
  const spec = Object.values(PLUS_MEMBERSHIP_OFFER.prices).find(
    (price) => price.key === plan
  );
  if (spec === undefined) {
    throw new Error(`${actor}'s billing screen shows no current plan`);
  }
  return spec.unitAmount;
}

const COVERED_RENEWALS = 36;

Given(
  "{actor}'s Plus credit no longer covers a renewal",
  async (w, actor: Actor) => {
    for (let step = 0; step < COVERED_RENEWALS; step += 1) {
      const due = await renewalCents(w, actor);
      const shown = await shownWhere(w, actor, () => true);
      // Nothing left (including 0 on a yearly plan) does not cover the charge.
      if (shown.creditCents < due) return;
      const before = shown.creditCents;
      await observe(w, actor, 'period_end');
      await shownWhere(
        w,
        actor,
        (next) =>
          next.creditCents < before &&
          (next.state === 'active' || next.state === 'trialing')
      );
    }
    throw new Error(`${actor}'s Plus credit still covers the next renewal`);
  }
);

// ------------------------------------------------------ what the screen shows

Then("{actor}'s membership is trialing", async (w, actor: Actor) => {
  await shownWhere(w, actor, (shown) => shown.state === 'trialing');
});

Then("{actor}'s membership is active", async (w, actor: Actor) => {
  await shownWhere(w, actor, (shown) => shown.state === 'active');
});

Then("{actor}'s membership is (still )delinquent", async (w, actor: Actor) => {
  await shownWhere(w, actor, (shown) => shown.state === 'delinquent');
});

Then("{actor}'s membership has ended", async (w, actor: Actor) => {
  await shownWhere(w, actor, (shown) => shown.state === 'ended');
});

Then(
  "{actor}'s membership is trialing on the monthly plan",
  async (w, actor: Actor) => {
    await shownWhere(w, actor, (shown) => shown.state === 'trialing');
    await expectPlan(w, actor, MONTHLY);
  }
);

Then(
  "{actor}'s membership is active on the monthly plan",
  async (w, actor: Actor) => {
    await shownWhere(w, actor, (shown) => shown.state === 'active');
    await expectPlan(w, actor, MONTHLY);
  }
);

Then(
  "{actor}'s membership is active on the yearly plan",
  async (w, actor: Actor) => {
    await shownWhere(w, actor, (shown) => shown.state === 'active');
    await expectPlan(w, actor, YEARLY);
  }
);

Then("{actor}'s membership is on the yearly plan", async (w, actor: Actor) => {
  await expectPlan(w, actor, YEARLY);
});

Then(
  "{actor}'s membership is set to end at the period end",
  async (w, actor: Actor) => {
    await shownWhere(w, actor, (shown) => shown.state === 'canceling');
  }
);

Then(
  "{actor}'s membership is no longer set to end at the period end",
  async (w, actor: Actor) => {
    await shownWhere(w, actor, (shown) => shown.state !== 'canceling');
  }
);

/**
 * The same sentence is a Given and a Then. Matching ignores the keyword, so
 * one definition serves both: still on the yearly plan with nothing left,
 * switch to monthly; then the screen must show that credit.
 */
Step(
  '{actor} has Plus credit from the yearly plan',
  async (w, actor: Actor) => {
    await onBilling(w, actor);
    const plan = await w.s.until(
      (harness) => currentPlan(harness, actor, PLANS),
      {
        ...SHOWN_WAIT,
        pred: (shown) => shown !== null,
      }
    );
    const shown = await shownWhere(w, actor, () => true);
    if (shown.creditCents <= 0 && plan === YEARLY) {
      await w.s.apply(switchPlusInterval, actor, MONTHLY);
    }
    const next = await shownWhere(
      w,
      actor,
      (candidate) => candidate.creditCents > 0
    );
    expect(next.creditCents).toBeGreaterThan(0);
    const text = await w.s.read(nodeText, actor, [Handles.billingCredit]);
    expect(text ?? '').toMatch(/Plus credit/i);
    expect(text ?? '').toMatch(/yearly plan/i);
  }
);

Then("{actor}'s renewal date moves later", async (w, actor: Actor) => {
  const before = recall(w, renewalKey(actor)) as number;
  const shown = await shownWhere(
    w,
    actor,
    (candidate) => (candidate.periodEndMs ?? 0) > before
  );
  expect(shown.periodEndMs ?? 0).toBeGreaterThan(before);
});
