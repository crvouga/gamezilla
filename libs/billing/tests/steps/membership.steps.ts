/**
 * Membership lifecycle steps: what the provider does to a membership (period
 * ends, failed and recovered payments, cancel and resume, interval switches,
 * the billing portal) and what the person's synced membership then says.
 * Comparisons follow "record, then compare": a Given records the value in
 * world state and a Then compares against it.
 */

import { expect } from 'bun:test';

import {
  cancelPlus,
  checkoutPlusAtProvider,
  observeMembership,
  resumePlus,
  switchPlusInterval,
} from '@libs/billing/sim/billing-actions';
import type { BillingObserveKind } from '@libs/billing/sim/billing-provider-driver';
import {
  type MembershipRowView,
  membershipRow,
  membershipRows,
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
/** Provider webhooks sync to the device within a few virtual seconds. */
const ROW_WAIT = { maxMs: 60_000, stepMs: 1_000 } as const;
/** Long enough for a redelivered event to have reached the device. */
const SETTLE_MS = 6_000;

const periodEndKey = (actor: Actor) => `billing-period-end:${actor}`;
const rowKey = (actor: Actor) => `billing-membership:${actor}`;

async function observe(
  w: SimWorld,
  actor: Actor,
  kind: BillingObserveKind
): Promise<void> {
  await w.s.apply(observeMembership, actor, kind);
}

async function rowWhere(
  w: SimWorld,
  actor: Actor,
  match: (row: MembershipRowView) => boolean
): Promise<MembershipRowView> {
  const row = await w.s.until((sim) => membershipRow(sim, actor), {
    ...ROW_WAIT,
    pred: (candidate) => candidate !== null && match(candidate),
  });
  if (row === null) throw new Error(`${actor} has no membership`);
  return row;
}

async function currentRow(
  w: SimWorld,
  actor: Actor
): Promise<MembershipRowView> {
  return await rowWhere(w, actor, () => true);
}

function periodEnd(row: MembershipRowView): number {
  return Date.parse(row.current_period_end ?? '');
}

// ------------------------------------------------------ provider lifecycle

When("{actor}'s billing period ends", async (w, actor: Actor) => {
  await observe(w, actor, 'period_end');
});

Given("{actor}'s billing period has ended", async (w, actor: Actor) => {
  await observe(w, actor, 'period_end');
});

When("{actor}'s payment fails", async (w, actor: Actor) => {
  await observe(w, actor, 'payment_failed');
});

Given("{actor}'s payment has failed", async (w, actor: Actor) => {
  await observe(w, actor, 'payment_failed');
  // "Has failed" is settled state: the delinquent row has reached the device.
  await rowWhere(w, actor, (row) => row.status === 'delinquent');
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
  'the provider delivers its last event for {actor} again',
  async (w, actor: Actor) => {
    await observe(w, actor, 'redeliver_last_event');
  }
);

Given(
  "{actor}'s membership is set to cancel at the period end",
  async (w, actor: Actor) => {
    await observe(w, actor, 'cancel_at_period_end');
    await rowWhere(w, actor, (row) => row.cancel_at_period_end === 1);
  }
);

When("{actor}'s membership is resumed", async (w, actor: Actor) => {
  await observe(w, actor, 'resume');
});

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
  }
);

When(
  "{actor}'s membership switches to the yearly plan",
  async (w, actor: Actor) => {
    await observe(w, actor, 'switch_interval');
  }
);

When(
  '{actor} checks out Plus again with the provider',
  async (w, actor: Actor) => {
    // The billing screen hides Subscribe while grace still grants access, so
    // the fresh checkout starts at the provider.
    await w.s.apply(checkoutPlusAtProvider, actor);
  }
);

// ------------------------------------------------------ the billing portal

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
    await rowWhere(w, actor, (row) => row.cancel_at_period_end === 1);
    await w.s.advanceTime(SETTLE_MS);
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
    await w.s.apply(switchPlusInterval, actor, YEARLY);
  }
);

// ------------------------------------------------------ the synced membership

Then("{actor}'s membership is trialing", async (w, actor: Actor) => {
  await rowWhere(w, actor, (row) => row.status === 'trialing');
});

Then("{actor}'s membership is active", async (w, actor: Actor) => {
  await rowWhere(w, actor, (row) => row.status === 'active');
});

Then("{actor}'s membership is delinquent", async (w, actor: Actor) => {
  await rowWhere(w, actor, (row) => row.status === 'delinquent');
});

Then("{actor}'s membership has ended", async (w, actor: Actor) => {
  await rowWhere(w, actor, (row) => row.status === 'ended');
});

Then(
  "{actor}'s membership is trialing on the monthly plan",
  async (w, actor: Actor) => {
    await rowWhere(
      w,
      actor,
      (row) => row.status === 'trialing' && row.price_key === MONTHLY
    );
  }
);

Then(
  "{actor}'s membership is active on the monthly plan",
  async (w, actor: Actor) => {
    await rowWhere(
      w,
      actor,
      (row) => row.status === 'active' && row.price_key === MONTHLY
    );
  }
);

Then("{actor}'s membership is on the yearly plan", async (w, actor: Actor) => {
  await rowWhere(w, actor, (row) => row.price_key === YEARLY);
});

Then(
  "{actor}'s membership is set to end at the period end",
  async (w, actor: Actor) => {
    await rowWhere(w, actor, (row) => row.cancel_at_period_end === 1);
  }
);

Then(
  "{actor}'s membership is no longer set to end at the period end",
  async (w, actor: Actor) => {
    await rowWhere(w, actor, (row) => row.cancel_at_period_end === 0);
  }
);

Then(
  "{actor}'s membership has a current period end",
  async (w, actor: Actor) => {
    expect(periodEnd(await currentRow(w, actor))).toBeGreaterThan(0);
  }
);

Then('{actor} has two memberships', async (w, actor: Actor) => {
  await w.s.until((sim) => membershipRows(sim, actor), {
    ...ROW_WAIT,
    pred: (rows) => rows.length === 2,
  });
});

Then(
  "{actor}'s newest membership is trialing on the monthly plan",
  async (w, actor: Actor) => {
    const rows = await w.s.read(membershipRows, actor);
    const newest = rows.at(-1);
    expect(newest?.status).toBe('trialing');
    expect(newest?.price_key).toBe(MONTHLY);
  }
);

// ------------------------------------------------------ record, then compare

Given("{actor}'s current period end is recorded", async (w, actor: Actor) => {
  remember(w, periodEndKey(actor), periodEnd(await currentRow(w, actor)));
});

Then(
  "{actor}'s period end is earlier than the recorded one",
  async (w, actor: Actor) => {
    const recorded = recall(w, periodEndKey(actor)) as number;
    expect(periodEnd(await currentRow(w, actor))).toBeLessThan(recorded);
  }
);

Then(
  "{actor}'s period end is later than the recorded one",
  async (w, actor: Actor) => {
    const recorded = recall(w, periodEndKey(actor)) as number;
    expect(periodEnd(await currentRow(w, actor))).toBeGreaterThan(recorded);
  }
);

Given("{actor}'s membership is recorded", async (w, actor: Actor) => {
  remember(w, rowKey(actor), await currentRow(w, actor));
});

Then(
  "{actor}'s membership matches the recorded one",
  async (w, actor: Actor) => {
    await w.s.advanceTime(SETTLE_MS);
    expect(await currentRow(w, actor)).toEqual(
      recall(w, rowKey(actor)) as MembershipRowView
    );
  }
);
