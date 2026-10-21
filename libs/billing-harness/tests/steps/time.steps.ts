/**
 * Time and the connection: days going by for everyone, a device away from the
 * network for days, and paid access showing up within a bound.
 */

import { openBilling } from '@libs/billing-harness/billing-actions';
import { billingTier } from '@libs/billing-harness/billing-reads';
import { letTimePass } from '@libs/harness/actions';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { cutConnection, otherDevice } from '@libs/harness/platform';
import { focusActor } from '@libs/harness/shell-actions';

const DAY_MS = 24 * 60 * 60 * 1000;
const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;

When('{int} days pass', async (w, days: number) => {
  await w.s.apply(letTimePass, days * DAY_MS);
});

When('{int} minutes pass', async (w, minutes: number) => {
  await w.s.apply(letTimePass, minutes * MINUTE_MS);
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
    await w.s.until((harness) => billingTier(harness, actor), {
      pred: (shown) => shown === 'paid',
      maxMs: seconds * SECOND_MS,
    });
  }
);

Then(
  "{actor}'s other device has paid access within {int} seconds",
  async (w, actor: Actor, seconds: number) => {
    await w.s.apply(openBilling, otherDevice(actor));
    await w.s.until((harness) => billingTier(harness, otherDevice(actor)), {
      pred: (shown) => shown === 'paid',
      maxMs: seconds * SECOND_MS,
    });
  }
);
