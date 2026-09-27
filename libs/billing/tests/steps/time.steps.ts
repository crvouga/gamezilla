/**
 * Time and the connection: days going by for everyone, a device away from the
 * network for days, and paid access showing up within a bound.
 */

import { openBilling } from '@libs/billing/sim/billing-actions';
import { billingTier } from '@libs/billing/sim/billing-reads';
import { focusActor } from '@libs/sim-harness';
import { type Actor, Given, Then, When } from '@libs/sim-harness/spec/define';
import {
  cutConnection,
  otherDevice,
} from '@libs/sim-harness/spec/steps/platform';
import { letTimePass } from '@libs/sim-harness/system/actions';

const DAY_MS = 24 * 60 * 60 * 1000;
const SECOND_MS = 1_000;

When('{int} days pass', async (w, days: number) => {
  await w.s.apply(letTimePass, days * DAY_MS);
});

Given(
  '{actor} has been offline for {int} days',
  async (w, actor: Actor, days: number) => {
    await cutConnection(w, actor);
    await w.s.apply(letTimePass, days * DAY_MS);
  }
);

Then(
  '{actor} has paid access within {int} seconds',
  async (w, actor: Actor, seconds: number) => {
    await w.s.apply(focusActor, actor);
    await w.s.until((sim) => billingTier(sim, actor), {
      pred: (shown) => shown === 'paid',
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then(
  "{actor}'s other device has paid access within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    await w.s.apply(openBilling, otherDevice(actor));
    await w.s.until((sim) => billingTier(sim, otherDevice(actor)), {
      pred: (shown) => shown === 'paid',
      maxMs: seconds * SECOND_MS,
    });
  }
);
