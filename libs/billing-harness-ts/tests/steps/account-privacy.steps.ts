import { expect } from 'bun:test';
import { confirmedAccount } from '@libs/account-privacy-harness-ts/privacy.steps';
import { openPrivacy } from '@libs/account-privacy-harness-ts/privacy-actions';
import { privacyText } from '@libs/account-privacy-harness-ts/privacy-reads';
import {
  agePaymentRetention,
  cancellationPending,
  membershipCannotRenew,
  minimumPayments,
  newestPaymentRefund,
  paymentAfterDeletion,
  paymentHasLegalHold,
  resumeCancellation,
} from '@libs/billing-harness-ts/account-privacy';
import { openBilling } from '@libs/billing-harness-ts/billing-actions';
import { billingTier } from '@libs/billing-harness-ts/billing-reads';
import { Given, Then, When } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { recall, signedInAccountKey } from '@libs/harness-ts/spec-world';

Then(
  "{actor}'s membership cannot renew because the account was deleted",
  async (w, actor: Actor) => {
    expect(
      await w.s.read(
        membershipCannotRenew,
        String(recall(w, signedInAccountKey(actor)))
      )
    ).toBe(true);
  }
);
Then('{actor} no longer has paid access', async (w, actor: Actor) => {
  await w.s.apply(openBilling, actor);
  expect(await w.s.read(billingTier, actor)).not.toBe('paid');
});
When('{actor} views the account deletion outcome', async (w, actor: Actor) => {
  await w.s.apply(openPrivacy, actor);
});
Then(
  '{actor} is told cancellation is still being completed',
  async (w, actor: Actor) => {
    expect(
      await w.s.read(privacyText, actor, 'privacy-cancellation-outcome')
    ).toContain('still being completed');
  }
);
Then(
  '{actor} is not told the membership cancellation has completed',
  async (w, actor: Actor) => {
    expect(
      await w.s.read(privacyText, actor, 'privacy-cancellation-outcome')
    ).not.toContain('has completed');
  }
);

Given('the payment provider has not yet confirmed cancellation', async (w) => {
  expect(
    await w.s.read(
      cancellationPending,
      String(recall(w, signedInAccountKey('alice')))
    )
  ).toBe(true);
});
When(
  "{actor}'s payment provider takes another membership payment",
  async (w, actor: Actor) => {
    await w.s.apply(resumeCancellation);
    await w.s.apply(
      paymentAfterDeletion,
      String(recall(w, signedInAccountKey(actor)))
    );
  }
);
Then(
  'that payment is refunded in full because account deletion had already been confirmed',
  async (w) => {
    const payment = await w.s.until(
      (s) =>
        newestPaymentRefund(s, String(recall(w, signedInAccountKey('alice')))),
      {
        maxMs: 20_000,
        pred: (payment) =>
          payment.paid > 0 && payment.refunded === payment.paid,
      }
    );
    expect(payment.refunded).toBe(payment.paid);
  }
);
Given(
  '{actor} made a membership payment less than 7 years ago',
  async (w, actor: Actor) => {
    expect(
      (
        await w.s.read(
          minimumPayments,
          String(recall(w, signedInAccountKey(actor)))
        )
      ).length
    ).toBeGreaterThan(0);
  }
);
Given(
  "{actor}'s payment record is still retained for accounting",
  async (w, actor: Actor) => {
    expect(
      (
        await w.s.read(
          minimumPayments,
          String(recall(w, signedInAccountKey(actor)))
        )
      ).length
    ).toBeGreaterThan(0);
  }
);
When('the team reviews that payment record for accounting', async (w) => {
  await w.s.read(
    minimumPayments,
    String(recall(w, signedInAccountKey('alice')))
  );
});
Then('the team can see its minimum payment evidence', async (w) => {
  const payments = await w.s.read(
    minimumPayments,
    String(recall(w, signedInAccountKey('alice')))
  );
  expect(payments.length).toBeGreaterThan(0);
  expect(payments[0]).toMatchObject({
    provider: expect.any(String),
    payment_id: expect.any(String),
    paid_at: expect.any(String),
    amount_minor: expect.any(Number),
    currency: expect.any(String),
    refunded_minor: expect.any(Number),
  });
});
Then(
  "{actor}'s payment record cannot restore the deleted account's membership",
  async (w, actor: Actor) => {
    expect(
      await w.s.read(
        membershipCannotRenew,
        String(recall(w, signedInAccountKey(actor)))
      )
    ).toBe(true);
  }
);
Given(
  "{actor}'s payment record is 7 years old",
  async (w: PrivacySetupWorld, actor: Actor) => {
    await confirmedAccount(w, actor, 'completed');
    const accountId = recall(w, signedInAccountKey(actor));
    await w.s.apply(agePaymentRetention, String(accountId));
  }
);
Given('no specific legal preservation obligation applies to it', async (w) => {
  expect(
    await w.s.read(
      paymentHasLegalHold,
      String(recall(w, signedInAccountKey('alice')))
    )
  ).toBe(false);
});
When('the team reviews payment records due for erasure', async (w) => {
  await w.s.apply(runPrivacyJobs);
});
Then(
  'that payment record cannot remain because its retention period has expired',
  async (w) => {
    expect(
      await w.s.read(
        minimumPayments,
        String(recall(w, signedInAccountKey('alice')))
      )
    ).toEqual([]);
  }
);

import type { PrivacySetupWorld } from '@libs/account-privacy-harness-ts/privacy.steps';
import { runPrivacyJobs } from '@libs/account-privacy-harness-ts/privacy-actions';
