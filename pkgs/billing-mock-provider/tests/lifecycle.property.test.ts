/**
 * Model-based property test: random sequences of everything a person, the
 * app and a tester can do to a Stripe-shaped provider — check out (every test
 * card, with and without a trial, with or without a card), let time pass,
 * cancel at period end, renew, cancel now, switch price (prorated or not),
 * change the card, pay the open invoice off- and on-session, resume a pause,
 * resend an event — run against the real provider (through the real adapter
 * and its signed webhooks) and against {@link ReferenceModel}. After every
 * step the two must agree, and the provider's own books must balance.
 */
import { describe, expect, test } from 'bun:test';
import type { MembershipChange } from '@pkgs/billing';
import {
  MOCK_BILLING_PATHS,
  MOCK_TEST_PAYMENT_METHODS,
  type MockCustomer,
  type MockEvent,
  type MockInvoice,
  type MockList,
  type MockSubscription,
  type MockTestPaymentMethod,
} from '@pkgs/billing-mock';
import {
  MOCK_BILLING_PAGE_API,
  type PortalAction,
} from '@pkgs/billing-mock-provider/shared';
import { assertProperty, fc } from '@pkgs/sim/fast-check';
import {
  type Delivered,
  openRig,
  page,
  RETURN_URL,
  type Rig,
  START_MS,
  sessionId,
} from './support/provider-rig';
import {
  type Card,
  DAY_S,
  expectedMembership,
  type MissingCard,
  type ModelSubscription,
  type PriceKey,
  ReferenceModel,
  WIRE_STATUS,
} from './support/reference-model';

const CARD: Readonly<Record<Card, MockTestPaymentMethod>> = {
  visa: MOCK_TEST_PAYMENT_METHODS.visa,
  fails: MOCK_TEST_PAYMENT_METHODS.chargeCustomerFail,
  declined: MOCK_TEST_PAYMENT_METHODS.chargeDeclined,
  sca: MOCK_TEST_PAYMENT_METHODS.authenticationRequired,
};

const LOOKUP: Readonly<Record<PriceKey, string>> = {
  monthly: 'subscription_monthly',
  yearly: 'subscription_yearly',
};

type Op =
  | {
      readonly kind: 'checkout';
      readonly card: Card | null;
      readonly price: PriceKey;
      readonly trial: boolean;
      readonly missingCard: MissingCard;
    }
  | { readonly kind: 'advance'; readonly seconds: number }
  | { readonly kind: 'cancel_at_period_end'; readonly cancel: boolean }
  | { readonly kind: 'cancel_now' }
  | { readonly kind: 'switch'; readonly prorate: boolean }
  | { readonly kind: 'use_card'; readonly card: Card }
  | { readonly kind: 'pay_invoice' }
  | { readonly kind: 'portal_pay'; readonly card: Card }
  | { readonly kind: 'resume' }
  | { readonly kind: 'resend' };

const card = fc.constantFrom<Card>('visa', 'fails', 'declined', 'sca');

const checkoutOp = fc
  .record({
    card: fc.option(card, { nil: null, freq: 4 }),
    price: fc.constantFrom<PriceKey>('monthly', 'yearly'),
    trial: fc.boolean(),
    missingCard: fc.constantFrom<MissingCard>(
      'cancel',
      'pause',
      'create_invoice'
    ),
  })
  // A card may be left out only for a trial that asks for none.
  .map((op) => ({
    kind: 'checkout' as const,
    ...op,
    trial: op.trial || op.card === null,
  }));

const opArb: fc.Arbitrary<Op> = fc.oneof(
  { weight: 3, arbitrary: checkoutOp },
  {
    weight: 5,
    arbitrary: fc
      .oneof(
        fc.integer({ min: 0, max: DAY_S }),
        fc.integer({ min: 1, max: 12 }).map((days) => days * DAY_S),
        fc.integer({ min: 25, max: 400 }).map((days) => days * DAY_S)
      )
      .map((seconds) => ({ kind: 'advance' as const, seconds })),
  },
  {
    weight: 2,
    arbitrary: fc
      .boolean()
      .map((cancel) => ({ kind: 'cancel_at_period_end' as const, cancel })),
  },
  { weight: 1, arbitrary: fc.constant({ kind: 'cancel_now' as const }) },
  {
    weight: 2,
    arbitrary: fc
      .boolean()
      .map((prorate) => ({ kind: 'switch' as const, prorate })),
  },
  {
    weight: 2,
    arbitrary: card.map((c) => ({ kind: 'use_card' as const, card: c })),
  },
  { weight: 1, arbitrary: fc.constant({ kind: 'pay_invoice' as const }) },
  {
    weight: 1,
    arbitrary: card.map((c) => ({ kind: 'portal_pay' as const, card: c })),
  },
  { weight: 1, arbitrary: fc.constant({ kind: 'resume' as const }) },
  { weight: 1, arbitrary: fc.constant({ kind: 'resend' as const }) }
);

/** The world, the model, and which provider id each model subscription is. */
type Run = {
  readonly world: Rig;
  readonly model: ReferenceModel;
  customer: string | null;
  readonly ids: string[];
  readonly seen: Map<string, string>;
};

async function get<T>(run: Run, path: string): Promise<T> {
  const response = await run.world.call('GET', path);
  expect(response.status).toBe(200);
  return response.body as T;
}

async function subscriptions(run: Run): Promise<readonly MockSubscription[]> {
  if (run.customer === null) return [];
  const list = await get<MockList<MockSubscription>>(
    run,
    `${MOCK_BILLING_PATHS.subscriptions}?customer=${run.customer}&status=all&limit=100`
  );
  return [...list.data].reverse();
}

function liveId(run: Run): string | null {
  const live = run.model.live();
  return live === null ? null : (run.ids[live.index] ?? null);
}

async function checkout(run: Run, op: Extract<Op, { kind: 'checkout' }>) {
  const { world } = run;
  const started = await world.billing.startCheckout({
    accountId: 'acct-model',
    customerId: run.customer,
    email: null,
    returnUrl: RETURN_URL,
  });
  run.customer = started.customerId;
  const created = await world.call(
    'POST',
    MOCK_BILLING_PATHS.checkoutSessions,
    {
      mode: 'subscription',
      customer: run.customer,
      payment_method_collection: op.card === null ? 'if_required' : 'always',
      line_items: [{ price: `price_${LOOKUP[op.price].replaceAll('_', '')}` }],
      success_url: RETURN_URL,
      cancel_url: RETURN_URL,
      subscription_data: {
        ...(op.trial ? { trial_period_days: 7 } : {}),
        trial_settings: {
          end_behavior: { missing_payment_method: op.missingCard },
        },
      },
    }
  );
  expect(created.status).toBe(200);
  const id = sessionId((created.body as { url: string }).url);
  const price = `price_${LOOKUP[op.price].replaceAll('_', '')}`;
  const confirm = await page(world, MOCK_BILLING_PAGE_API.checkoutConfirm(id), {
    price,
    paymentMethod: op.card === null ? null : CARD[op.card],
  });
  const accepted = run.model.checkout(op);
  expect(confirm.status).toBe(accepted ? 200 : 402);
  if (accepted) {
    const all = await subscriptions(run);
    run.ids.push(all.at(-1)?.id ?? '');
  }
}

async function portalAct(run: Run, action: PortalAction) {
  if (run.customer === null) return null;
  const { url } = await run.world.billing.openPortal({
    accountId: 'acct-model',
    customerId: run.customer,
    returnUrl: RETURN_URL,
  });
  return await page(
    run.world,
    MOCK_BILLING_PAGE_API.portalAction(sessionId(url)),
    action
  );
}

async function subscriptionOp(
  run: Run,
  op: Op,
  sub: ModelSubscription,
  id: string
): Promise<void> {
  const { world, model } = run;
  const path = MOCK_BILLING_PATHS.subscription(id);
  if (op.kind === 'cancel_at_period_end') {
    const res = await world.call('POST', path, {
      cancel_at_period_end: op.cancel,
    });
    const refused =
      sub.status === 'paused' && sub.cancelAtPeriodEnd !== op.cancel;
    expect(res.status).toBe(refused ? 400 : 200);
    if (!refused) sub.cancelAtPeriodEnd = op.cancel;
  } else if (op.kind === 'cancel_now') {
    expect((await world.call('DELETE', path)).status).toBe(200);
    model.cancelNow(sub);
  } else if (op.kind === 'switch') {
    const next: PriceKey = sub.price === 'monthly' ? 'yearly' : 'monthly';
    const res = await world.call('POST', path, {
      items: [{ price: `price_${LOOKUP[next].replaceAll('_', '')}` }],
      proration_behavior: op.prorate ? 'create_prorations' : 'none',
    });
    expect(res.status).toBe(200);
    model.switchPrice(sub, op.prorate);
  } else if (op.kind === 'resume') {
    const res = await world.call(
      'POST',
      MOCK_BILLING_PATHS.subscriptionResume(id)
    );
    expect(res.status).toBe(sub.status === 'paused' ? 200 : 400);
    if (sub.status === 'paused') model.resume(sub);
  } else if (op.kind === 'pay_invoice') {
    await payInvoice(run, sub, id);
  }
}

async function payInvoice(run: Run, sub: ModelSubscription, id: string) {
  if (run.customer === null || run.model.openInvoice(sub) === null) return;
  const invoices = await get<MockList<MockInvoice>>(
    run,
    `${MOCK_BILLING_PATHS.invoices}?customer=${run.customer}&subscription=${id}&limit=100`
  );
  const open = invoices.data.find((invoice) => invoice.status === 'open');
  expect(open).toBeDefined();
  const res = await run.world.call(
    'POST',
    MOCK_BILLING_PATHS.invoicePay(open?.id ?? '')
  );
  const paid = run.model.pay(sub, 'off');
  expect(res.status).toBe(paid ? 200 : 402);
}

async function resend(run: Run) {
  const events = await get<MockList<MockEvent>>(
    run,
    `${MOCK_BILLING_PATHS.events}?type=customer.subscription.updated&limit=1`
  );
  const event = events.data[0];
  if (event === undefined) return;
  const res = await run.world.call(
    'POST',
    MOCK_BILLING_PATHS.resendEvent(event.id)
  );
  expect(res.status).toBe(200);
}

async function customerOp(run: Run, op: Op): Promise<boolean> {
  if (op.kind === 'checkout') {
    if (run.model.live() === null) await checkout(run, op);
    return true;
  }
  if (op.kind === 'resend') {
    await resend(run);
    return true;
  }
  if (run.customer === null) return true;
  if (op.kind === 'advance') {
    const until = run.model.nowS + op.seconds;
    const res = await run.world.call(
      'POST',
      MOCK_BILLING_PATHS.advanceCustomerClock(run.customer),
      { frozen_time: until }
    );
    expect(res.status).toBe(200);
    run.model.advanceTo(until);
    return true;
  }
  if (op.kind === 'use_card') {
    const res = await run.world.call(
      'POST',
      MOCK_BILLING_PATHS.customer(run.customer),
      {
        invoice_settings: { default_payment_method: CARD[op.card] },
      }
    );
    expect(res.status).toBe(run.model.setCard(op.card) ? 200 : 402);
    return true;
  }
  if (op.kind === 'portal_pay') {
    const res = await portalAct(run, {
      kind: 'update_payment_method',
      paymentMethod: CARD[op.card],
    });
    expect(res?.status).toBe(run.model.portalPay(op.card) ? 200 : 402);
    return true;
  }
  return false;
}

async function apply(run: Run, op: Op): Promise<void> {
  if (await customerOp(run, op)) return;
  const sub = run.model.live();
  const id = liveId(run);
  if (sub === null || id === null) return;
  await subscriptionOp(run, op, sub, id);
}

/** The provider's state matches the model's, subscription by subscription. */
async function assertAgrees(run: Run): Promise<void> {
  const all = await subscriptions(run);
  expect(all.map((s) => s.id)).toEqual(run.ids);
  for (const [index, sub] of run.model.subscriptions.entries()) {
    const wire = all[index];
    expect({
      index,
      status: wire?.status,
      cancel: wire?.cancel_at_period_end,
      periodEnd: wire?.items.data[0]?.current_period_end,
      price: wire?.items.data[0]?.price.lookup_key,
      endedAt: wire?.ended_at,
    }).toEqual({
      index,
      status: WIRE_STATUS[sub.status],
      cancel: sub.cancelAtPeriodEnd,
      periodEnd: sub.periodEndS,
      price: LOOKUP[sub.price],
      endedAt: sub.endedAtS,
    });
  }
  if (run.customer !== null) {
    const customer = await get<MockCustomer>(
      run,
      MOCK_BILLING_PATHS.customer(run.customer)
    );
    expect(customer.balance).toBe(run.model.balance);
    expect(customer.test_clock_frozen_time).toBe(run.model.nowS);
  }
}

/** Every invoice's arithmetic holds, and nothing is paid twice. */
async function assertBooksBalance(run: Run, delivered: readonly Delivered[]) {
  if (run.customer === null) return;
  const invoices = await get<MockList<MockInvoice>>(
    run,
    `${MOCK_BILLING_PATHS.invoices}?customer=${run.customer}&limit=100`
  );
  const numbers = new Set<string | null>();
  for (const invoice of invoices.data) {
    const sum = invoice.lines.data.reduce(
      (total, line) => total + line.amount,
      0
    );
    expect(invoice.total).toBe(sum);
    expect(invoice.amount_due).toBe(
      Math.max(0, sum + invoice.starting_balance)
    );
    expect(invoice.ending_balance).toBe(
      Math.min(0, sum + invoice.starting_balance)
    );
    expect(invoice.amount_paid + invoice.amount_remaining).toBe(
      invoice.amount_due
    );
    expect(['open', 'paid']).toContain(invoice.status);
    if (invoice.status === 'paid') expect(invoice.amount_remaining).toBe(0);
    numbers.add(invoice.number);
  }
  expect(numbers.size).toBe(invoices.data.length);
  run.seen.clear();
  for (const { event } of delivered) {
    if (event.type !== 'invoice.paid') continue;
    const id = (event.data.object as MockInvoice).id;
    // A resend may repeat an event; a second, different paid event may not.
    expect(run.seen.get(id) ?? event.id).toBe(event.id);
    run.seen.set(id, event.id);
  }
}

/** Every webhook verifies, and reports what the model says is true now. */
function assertDeliveries(run: Run, delivered: readonly Delivered[]): void {
  for (const { result } of delivered) {
    expect(result.kind).not.toBe('unverified');
    if (result.kind !== 'membership') continue;
    const change: MembershipChange = result;
    const sub = run.model.subscriptions[run.ids.indexOf(change.subscriptionId)];
    expect(sub).toBeDefined();
    if (sub === undefined) continue;
    expect({
      id: change.subscriptionId,
      membership: change.membership,
    }).toEqual({
      id: change.subscriptionId,
      membership: expectedMembership(sub),
    });
    expect(change.offerPriceKey).toBe(LOOKUP[sub.price]);
  }
}

async function runOps(ops: readonly Op[]): Promise<void> {
  const run: Run = {
    world: await openRig(),
    model: new ReferenceModel(START_MS / 1000),
    customer: null,
    ids: [],
    seen: new Map(),
  };
  for (const op of ops) {
    await apply(run, op);
    const delivered = await run.world.drain();
    assertDeliveries(run, delivered);
    await assertAgrees(run);
    await assertBooksBalance(run, delivered);
  }
}

describe('the provider against a reference model of Stripe', () => {
  test('any sequence of operations agrees with the model', async () => {
    await assertProperty(
      'provider ≡ model',
      fc.asyncProperty(fc.array(opArb, { minLength: 1, maxLength: 24 }), runOps)
    );
  }, 120_000);

  test('a year of failing renewals on a 3D Secure card agrees too', async () => {
    await runOps([
      {
        kind: 'checkout',
        card: 'sca',
        price: 'monthly',
        trial: false,
        missingCard: 'cancel',
      },
      { kind: 'advance', seconds: 40 * DAY_S },
      { kind: 'portal_pay', card: 'sca' },
      { kind: 'switch', prorate: true },
      { kind: 'advance', seconds: 400 * DAY_S },
    ]);
  });

  test('a trial without a card pauses, then resumes on a new card', async () => {
    await runOps([
      {
        kind: 'checkout',
        card: null,
        price: 'yearly',
        trial: true,
        missingCard: 'pause',
      },
      { kind: 'advance', seconds: 8 * DAY_S },
      { kind: 'use_card', card: 'visa' },
      { kind: 'resume' },
      { kind: 'switch', prorate: true },
      { kind: 'advance', seconds: 60 * DAY_S },
    ]);
  });
});
