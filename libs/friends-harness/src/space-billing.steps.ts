import { expect } from 'bun:test';
import {
  observeMembership,
  openBilling,
  providerEvent,
} from '@libs/billing-harness/billing-actions';
import { billingTier } from '@libs/billing-harness/billing-reads';
import { letTimePass } from '@libs/harness/actions';
import { Given } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';

const DAY_MS = 24 * 60 * 60 * 1_000;

Given("{actor}'s paid access has ended", async (w, actor: Actor) => {
  await w.s.apply(observeMembership, actor, 'cancel_now');
  await w.s.apply(providerEvent, actor, 'run_out_period');
  await w.s.apply(letTimePass, 8 * DAY_MS);
  await w.s.apply(openBilling, actor);
  expect(
    await w.s.until((s) => billingTier(s, actor), {
      maxMs: 20_000,
      pred: (tier) => tier === 'free',
    })
  ).toBe('free');
});
