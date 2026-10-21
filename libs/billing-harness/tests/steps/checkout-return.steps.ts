/**
 * Back from paying at checkout before the payment provider has confirmed
 * the payment: what the billing plans say meanwhile, and once it is
 * confirmed. Each step is one harness call or a fixed short sequence.
 */

import { expect } from 'bun:test';

import {
  holdPaymentConfirmations,
  releasePaymentConfirmations,
} from '@libs/billing-harness/billing-actions';
import {
  billingButtonVisible,
  billingNotice,
  membershipShown,
} from '@libs/billing-harness/billing-reads';
import { Given, Then, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';

/** What the screen says lands within a few virtual seconds. */
const SHOWN_WAIT = { maxMs: 30_000, stepMs: 1_000 } as const;

Given('the payment provider is slow to confirm payments', async (w) => {
  await w.s.apply(holdPaymentConfirmations);
});

When(
  "the payment provider confirms {actor}'s payment",
  async (w, _actor: Actor) => {
    await w.s.apply(releasePaymentConfirmations);
  }
);

Then(
  '{actor} is told their payment is still being confirmed',
  async (w, actor: Actor) => {
    await w.s.until((harness) => billingNotice(harness, actor), {
      ...SHOWN_WAIT,
      pred: (notice) => notice === 'confirming',
    });
  }
);

Then(
  '{actor} is not told their payment is still being confirmed',
  async (w, actor: Actor) => {
    // Read once the screen knows where the membership stands.
    await w.s.until((harness) => membershipShown(harness, actor), {
      ...SHOWN_WAIT,
      pred: (shown) => shown !== null && shown.state !== 'loading',
    });
    expect(await w.s.read(billingNotice, actor)).not.toBe('confirming');
  }
);

Then(
  '{actor} is told to check again before paying again',
  async (w, actor: Actor) => {
    await w.s.until((harness) => billingNotice(harness, actor), {
      ...SHOWN_WAIT,
      pred: (notice) => notice === 'unconfirmed',
    });
    expect(await w.s.read(billingButtonVisible, actor, 'checkAgain')).toBe(
      true
    );
  }
);
