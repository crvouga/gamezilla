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
} from '@libs/billing/sim/billing-actions';
import type { BillingObserveKind } from '@libs/billing/sim/billing-provider-driver';
import {
  currentPlan,
  type MembershipShown,
  membershipShown,
} from '@libs/billing/sim/billing-reads';
import {
  type Actor,
  Given,
  type SimWorld,
  Then,
  When,
} from '@libs/sim-harness/spec/define';
import { recall, remember } from '@libs/sim-harness/spec/world';

const MONTHLY = 'subscription_monthly';
const YEARLY = 'subscription_yearly';
const PLANS = [MONTHLY, YEARLY] as const;
/** Provider webhooks reach the device's screen within a few virtual seconds. */
const SHOWN_WAIT = { maxMs: 60_000, stepMs: 1_000 } as const;

/** Key of the renewal date the screen showed before the scenario's event. */
const renewalKey = (actor: Actor) => `billing-renewal-before:${actor}`;

/** Bring the billing screen into view if it is not already showing. */
async function onBilling(w: SimWorld, actor: Actor): Promise<void> {
  if ((await w.s.read(membershipShown, actor)) === null) {
    await w.s.apply(openBilling, actor);
  }
}

/** Wait until the actor's billing screen shows a membership matching `match`. */
async function shownWhere(
  w: SimWorld,
  actor: Actor,
  match: (shown: MembershipShown) => boolean
): Promise<MembershipShown> {
  await onBilling(w, actor);
  const shown = await w.s.until((sim) => membershipShown(sim, actor), {
    ...SHOWN_WAIT,
    pred: (candidate) => candidate !== null && match(candidate),
  });
  if (shown === null) throw new Error(`${actor}'s billing screen is not open`);
  return shown;
}

async function expectPlan(
  w: SimWorld,
  actor: Actor,
  plan: (typeof PLANS)[number]
): Promise<void> {
  await onBilling(w, actor);
  await w.s.until((sim) => currentPlan(sim, actor, PLANS), {
    ...SHOWN_WAIT,
    pred: (shown) => shown === plan,
  });
}

/** Remember the renewal date on screen before an event that should move it. */
async function rememberRenewal(w: SimWorld, actor: Actor): Promise<void> {
  const shown = await shownWhere(w, actor, (s) => s.periodEndMs !== null);
  remember(w, renewalKey(actor), shown.periodEndMs);
}

async function observe(
  w: SimWorld,
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
  "the provider gives up retrying {actor}'s payment",
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

// ------------------------------------------------------ what the screen shows

Then("{actor}'s membership is trialing", async (w, actor: Actor) => {
  await shownWhere(w, actor, (shown) => shown.state === 'trialing');
});

Then("{actor}'s membership is active", async (w, actor: Actor) => {
  await shownWhere(w, actor, (shown) => shown.state === 'active');
});

Then("{actor}'s membership is delinquent", async (w, actor: Actor) => {
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

Then("{actor}'s renewal date moves later", async (w, actor: Actor) => {
  const before = recall(w, renewalKey(actor)) as number;
  const shown = await shownWhere(
    w,
    actor,
    (candidate) => (candidate.periodEndMs ?? 0) > before
  );
  expect(shown.periodEndMs ?? 0).toBeGreaterThan(before);
});
