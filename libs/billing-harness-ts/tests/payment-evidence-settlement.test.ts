import '@libs/harness-ts/preload';

import { expect, test } from 'bun:test';
import {
  confirmDeletion,
  privacyTimePasses,
  proveAccount,
  runPrivacyJobs,
} from '@libs/account-privacy-harness-ts/privacy-actions';
import {
  agePaymentRetention,
  makeMembershipPayment,
  minimumPayments,
  pauseCancellation,
  paymentAfterDeletion,
  resumeCancellation,
} from '@libs/billing-harness-ts/account-privacy';
import {
  holdPaymentConfirmations,
  openBilling,
  subscribeToPlus,
} from '@libs/billing-harness-ts/billing-actions';
import { BILLING_WAIT_MS } from '@libs/billing-harness-ts/billing-gestures';
import {
  billingProviders,
  driveProvider,
} from '@libs/billing-harness-ts/billing-provider-driver';
import {
  paymentEraseBy,
  paymentRetentionEnded,
} from '@libs/billing-shared-ts/payment-evidence';
import { paymentReconciledEvent } from '@libs/billing-shared-ts/telemetry';
import { pollUntil, scenarioAction } from '@libs/harness-ts/actor-ui';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import type { OpenHarness } from '@libs/harness-ts/open-harness';
import sql from '@pkgs/sql-root-shared-ts/sql';
import Stripe from 'stripe';
import { openHarness } from './open-billing-harness';

// Product-harness wall-time contract: TIMEOUT_MS in libs/harness-ts/scripts/test-spec.ts.
const PRODUCT_HARNESS_TIMEOUT_MS = 240_000;

async function payer(s: OpenHarness): Promise<string> {
  await s.apply(signInWithGoogle, 'alice');
  await s.apply(openBilling, 'alice');
  await s.apply(subscribeToPlus, 'alice');
  await s.apply(privacyTimePasses, 604_801_000);
  return String(await s.read(signedInAccountOf, 'alice'));
}

type CapturedPayment = {
  chargeId: string;
  heldChargeId: string;
  event: Stripe.Event | null;
};

function capturePayment(accountId: string, capture: CapturedPayment) {
  return scenarioAction({
    name: 'capturePaymentAndStopRenewals',
    act: async (world) => {
      const payment = await pollUntil(
        world,
        async () =>
          (await minimumPayments(world, accountId)).find(
            (payment) => payment.amount_minor === 500
          ) ?? null,
        { maxMs: BILLING_WAIT_MS, description: 'captured payment evidence' }
      );
      capture.chargeId = payment.payment_id;
      const events = await billingProviders(world)
        .checkout()
        .stripe.events.list({ type: 'charge.succeeded', limit: 100 });
      capture.event =
        events.data.find(
          (event) =>
            event.type === 'charge.succeeded' &&
            event.data.object.id === payment.payment_id
        ) ?? null;
      const held = (await minimumPayments(world, accountId)).find(
        (candidate) => candidate.amount_minor === 700
      );
      if (held === undefined) throw new Error('Trial renewal payment missing');
      capture.heldChargeId = held.payment_id;
      await world.harness.serverSql.sqlClient.run(
        sql`UPDATE billing_payment_evidence SET legal_purpose = ${'A specific accounting preservation obligation'}, legal_end_condition = ${'The obligation is lifted'} WHERE payment_id = ${held.payment_id}`
      );
      await driveProvider(world, accountId, 'cancel_now');
    },
  });
}

function replayPayment(capture: CapturedPayment, statuses: number[]) {
  return scenarioAction({
    name: 'replayExpiredPaymentCallback',
    act: async (world) => {
      const provider = billingProviders(world).checkout();
      await provider.stripe.refunds.create({ charge: capture.heldChargeId });
      const payload = JSON.stringify(capture.event);
      const signature = await Stripe.webhooks.generateTestHeaderStringAsync({
        payload,
        secret: provider.webhookSecret,
        timestamp: Math.floor(world.harness.clock.now() / 1000),
      });
      const env = await world.harness.client('alice');
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await env.server(
          `${env.serverUrl}/api/billing/callback/${provider.id}`,
          {
            method: 'POST',
            headers: { 'stripe-signature': signature },
            body: payload,
          }
        );
        statuses.push(response.status);
        await response.body?.cancel();
      }
    },
  });
}

test(
  'a captured payment waits for its own durable evidence after delivery recovers',
  async () => {
    // regression: membership-payment-evidence-settlement
    await using s = await openHarness('delayed-payment-evidence');
    const accountId = await payer(s);
    await s.apply(makeMembershipPayment, accountId);
    expect(
      await s.until(
        async (world) =>
          (await minimumPayments(world, accountId)).some(
            (payment) => payment.amount_minor === 500
          ),
        { maxMs: BILLING_WAIT_MS, pred: (found) => found }
      )
    ).toBe(true);
    await s.apply(
      scenarioAction({
        name: 'delayPaymentDelivery',
        act: (world) => {
          world.harness.partition('billing', 'server-a');
          world.harness.partition('billing', 'server-b');
          world.session.ports.timers.setTimeout(() => {
            world.harness.heal('billing', 'server-a');
            world.harness.heal('billing', 'server-b');
          }, 3_500);
        },
      })
    );
    await s.apply(makeMembershipPayment, accountId);
    const payments = await s.read(minimumPayments, accountId);
    expect(
      payments.filter((payment) => payment.amount_minor === 500)
    ).toHaveLength(2);
  },
  PRODUCT_HARNESS_TIMEOUT_MS
);

test(
  'a real payment first settled by the cancellation consumer retains its expiry and telemetry',
  async () => {
    // regression: expired-payment-evidence-replay
    await using s = await openHarness('captured-consumer-payment-evidence');
    const accountId = await payer(s);
    await s.apply(proveAccount, 'alice');
    await s.apply(holdPaymentConfirmations);
    await s.apply(pauseCancellation);
    await s.apply(confirmDeletion, 'alice');
    await s.apply(paymentAfterDeletion, accountId);
    expect(
      (await s.read(minimumPayments, accountId)).filter(
        (payment) => payment.amount_minor === 500
      )
    ).toEqual([]);
    await s.apply(resumeCancellation);
    const payment = await s.until(
      async (world) =>
        (await minimumPayments(world, accountId)).find(
          (candidate) => candidate.amount_minor === 500
        ) ?? null,
      { maxMs: BILLING_WAIT_MS, pred: (found) => found !== null }
    );
    expect(payment).not.toBeNull();
    const events = await s.read((world) =>
      world.harness.serverSql.sqlClient.query(
        sql<{
          id: string;
          type: string;
          available_at: string;
          payload: string;
        }>`SELECT id, type, available_at, payload FROM outbox_events WHERE type IN (${paymentRetentionEnded.type}, ${paymentReconciledEvent.outbox.message.type})`
      )
    );
    expect(
      Date.parse(
        events.find(
          (event) =>
            event.id ===
            `billing-payment-retention:stripe:${payment?.payment_id}`
        )?.available_at ?? ''
      )
    ).toBe(Date.parse(paymentEraseBy(Date.parse(payment!.paid_at))));
    expect(
      events
        .filter(
          (event) => event.type === paymentReconciledEvent.outbox.message.type
        )
        .map((event) =>
          typeof event.payload === 'string'
            ? JSON.parse(event.payload)
            : event.payload
        )
        .some(
          (event) =>
            paymentReconciledEvent.outbox.message.validatePayload(event) &&
            event.attributes['payment.amount_minor'] === 500 &&
            event.attributes['payment.refunded_minor'] === 500
        )
    ).toBe(true);
  },
  PRODUCT_HARNESS_TIMEOUT_MS
);

test(
  'replayed real charge callbacks acknowledge erased payment evidence without restoring it',
  async () => {
    // regression: expired-payment-evidence-replay
    await using s = await openHarness('expired-payment-evidence-replay');
    const accountId = await payer(s);
    await s.apply(makeMembershipPayment, accountId);
    const capture: CapturedPayment = {
      chargeId: '',
      heldChargeId: '',
      event: null,
    };
    await s.apply(capturePayment(accountId, capture));
    expect(capture.event).not.toBeNull();
    await s.apply(agePaymentRetention, accountId);
    await s.apply(runPrivacyJobs);
    const evidence = () =>
      s.read((world) =>
        world.harness.serverSql.sqlClient.query(
          sql<
            Record<string, unknown>
          >`SELECT account_id, payment_id, paid_at, amount_minor, currency, refunded_minor, deleted_at FROM billing_payment_evidence WHERE id = ${`stripe:${capture.chargeId}`}`
        )
      );
    const erased = await evidence();
    expect(erased).toHaveLength(1);
    expect(erased[0]).toEqual({
      account_id: null,
      payment_id: null,
      paid_at: null,
      amount_minor: null,
      currency: null,
      refunded_minor: null,
      deleted_at: expect.any(String),
    });
    const statuses: number[] = [];
    await s.apply(replayPayment(capture, statuses));
    expect(statuses).toEqual([200, 200]);
    expect(await evidence()).toEqual(erased);
    const retained = await s.read(minimumPayments, accountId);
    expect(retained).toHaveLength(1);
    expect(retained[0]?.refunded_minor).toBe(700);
  },
  PRODUCT_HARNESS_TIMEOUT_MS
);
