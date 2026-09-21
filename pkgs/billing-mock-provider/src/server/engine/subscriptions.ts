/**
 * The subscription lifecycle, with Stripe's semantics:
 *
 * - a trial is a $0 first invoice and a `trialing` period that ends at
 *   `trial_end`; without a trial the first charge must succeed or no
 *   subscription is created (Checkout refuses the card);
 * - at a period end the next invoice is charged: paid → `active`, declined →
 *   `past_due` with retries; a subscription set to cancel ends instead;
 * - after the last failed retry the subscription is canceled;
 * - an immediate cancel ends it now (`ended_at`), keeping its old period;
 * - a price switch during a trial keeps the trial; otherwise a new interval
 *   restarts the period now and charges the difference at once.
 */
import type {
  MockCancellationDetails,
  MockPrice,
  MockSubscription,
  MockSubscriptionStatus,
} from '@pkgs/billing-mock/wire';

import { cardDeclined, invalidRequest, resourceMissing } from '../errors';
import { DAY_S, type Engine, emit, mint, previousAttributes } from './context';
import { attemptInvoice, createInvoice, openInvoiceOf } from './invoices';
import { periodEndS } from './prices';

const NO_CANCELLATION: MockCancellationDetails = {
  reason: null,
  feedback: null,
  comment: null,
};

/** Statuses a subscription never leaves. */
export const TERMINAL: ReadonlySet<MockSubscriptionStatus> =
  new Set<MockSubscriptionStatus>(['canceled', 'incomplete_expired']);

export function priceOf(subscription: MockSubscription): MockPrice {
  const item = subscription.items.data[0];
  if (item === undefined)
    throw new Error('mock billing: subscription has no item');
  return item.price;
}

export function currentPeriodEnd(subscription: MockSubscription): number {
  return subscription.items.data[0]?.current_period_end ?? 0;
}

function withPeriod(
  subscription: MockSubscription,
  args: {
    readonly price: MockPrice;
    readonly startS: number;
    readonly endS: number;
  }
): MockSubscription {
  const item = subscription.items.data[0];
  return {
    ...subscription,
    items: {
      ...subscription.items,
      data: [
        {
          id: item?.id ?? 'si_missing',
          object: 'subscription_item',
          price: args.price,
          quantity: 1,
          current_period_start: args.startS,
          current_period_end: args.endS,
        },
      ],
    },
  };
}

export async function requireSubscription(
  engine: Engine,
  id: string
): Promise<MockSubscription> {
  const subscription = await engine.db.get<MockSubscription>(
    id,
    'subscription'
  );
  if (subscription === null) throw resourceMissing('subscription', id);
  return subscription;
}

/** Stores `after` and emits the matching subscription event. */
export async function saveSubscription(
  engine: Engine,
  before: MockSubscription | null,
  after: MockSubscription,
  nowS: number
): Promise<MockSubscription> {
  await engine.db.put(after, after.customer);
  const ended =
    before !== null &&
    !TERMINAL.has(before.status) &&
    TERMINAL.has(after.status);
  await emit(engine, {
    type:
      before === null
        ? 'customer.subscription.created'
        : ended
          ? 'customer.subscription.deleted'
          : 'customer.subscription.updated',
    object: after,
    createdS: nowS,
    ...(before === null ? {} : { previous: previousAttributes(before, after) }),
  });
  return after;
}

function draftSubscription(
  engine: Engine,
  args: {
    readonly customer: string;
    readonly price: MockPrice;
    readonly nowS: number;
    readonly trialDays: number;
    readonly metadata: Readonly<Record<string, string>>;
    readonly paymentMethod: string | null;
  }
): MockSubscription {
  const trialEnd =
    args.trialDays > 0 ? args.nowS + args.trialDays * DAY_S : null;
  return {
    id: mint(engine, 'sub'),
    object: 'subscription',
    customer: args.customer,
    status: trialEnd === null ? 'active' : 'trialing',
    items: {
      object: 'list',
      has_more: false,
      url: '/v1/subscription_items',
      data: [
        {
          id: mint(engine, 'si'),
          object: 'subscription_item',
          price: args.price,
          quantity: 1,
          current_period_start: args.nowS,
          current_period_end: trialEnd ?? periodEndS(args.price, args.nowS),
        },
      ],
    },
    cancel_at_period_end: false,
    cancel_at: null,
    canceled_at: null,
    ended_at: null,
    cancellation_details: NO_CANCELLATION,
    trial_start: trialEnd === null ? null : args.nowS,
    trial_end: trialEnd,
    start_date: args.nowS,
    created: args.nowS,
    latest_invoice: null,
    default_payment_method: args.paymentMethod,
    metadata: args.metadata,
  };
}

/**
 * Starts a subscription. Without a trial the first charge must go through;
 * a declined card creates nothing (and rolls the step back).
 */
export async function startSubscription(
  engine: Engine,
  args: {
    readonly customer: string;
    readonly price: MockPrice;
    readonly nowS: number;
    readonly trialDays: number;
    readonly metadata: Readonly<Record<string, string>>;
    readonly paymentMethod: string | null;
  }
): Promise<MockSubscription> {
  const draft = draftSubscription(engine, args);
  const invoice = await attemptInvoice(
    engine,
    await createInvoice(engine, {
      customer: args.customer,
      subscription: draft.id,
      price: args.price,
      amount: args.trialDays > 0 ? 0 : args.price.unit_amount,
      reason: 'subscription_create',
      periodStartS: args.nowS,
      periodEndS: currentPeriodEnd(draft),
      nowS: args.nowS,
    }),
    args.nowS
  );
  if (invoice.status !== 'paid') throw cardDeclined();
  return await saveSubscription(
    engine,
    null,
    { ...draft, latest_invoice: invoice.id },
    args.nowS
  );
}

/** Ends a subscription at `endedAtS` (now, or the period end it reached). */
export async function endSubscription(
  engine: Engine,
  subscription: MockSubscription,
  args: {
    readonly endedAtS: number;
    readonly reason: MockCancellationDetails['reason'];
  }
): Promise<MockSubscription> {
  if (TERMINAL.has(subscription.status)) return subscription;
  return await saveSubscription(
    engine,
    subscription,
    {
      ...subscription,
      status: 'canceled',
      cancel_at_period_end: false,
      cancel_at: null,
      canceled_at: subscription.canceled_at ?? args.endedAtS,
      ended_at: args.endedAtS,
      cancellation_details: {
        ...subscription.cancellation_details,
        reason: subscription.cancellation_details.reason ?? args.reason,
      },
    },
    args.endedAtS
  );
}

export async function setCancelAtPeriodEnd(
  engine: Engine,
  subscription: MockSubscription,
  args: {
    readonly cancel: boolean;
    readonly feedback: string | null;
    readonly nowS: number;
  }
): Promise<MockSubscription> {
  if (TERMINAL.has(subscription.status)) {
    throw invalidRequest(
      'A canceled subscription can only update its metadata.',
      'cancel_at_period_end'
    );
  }
  return await saveSubscription(
    engine,
    subscription,
    {
      ...subscription,
      cancel_at_period_end: args.cancel,
      cancel_at: args.cancel ? currentPeriodEnd(subscription) : null,
      canceled_at: args.cancel ? args.nowS : null,
      cancellation_details: args.cancel
        ? {
            reason: 'cancellation_requested',
            feedback: args.feedback,
            comment: null,
          }
        : NO_CANCELLATION,
    },
    args.nowS
  );
}

/** Charges `amount` for a new period and settles the subscription on it. */
export async function billPeriod(
  engine: Engine,
  subscription: MockSubscription,
  args: {
    readonly price: MockPrice;
    readonly startS: number;
    readonly amount: number;
    readonly reason: 'subscription_cycle' | 'subscription_update';
    readonly nowS: number;
  }
): Promise<MockSubscription> {
  const endS = periodEndS(args.price, args.startS);
  const invoice = await attemptInvoice(
    engine,
    await createInvoice(engine, {
      customer: subscription.customer,
      subscription: subscription.id,
      price: args.price,
      amount: args.amount,
      reason: args.reason,
      periodStartS: args.startS,
      periodEndS: endS,
      nowS: args.nowS,
    }),
    args.nowS
  );
  const next = withPeriod(subscription, {
    price: args.price,
    startS: args.startS,
    endS,
  });
  return await saveSubscription(
    engine,
    subscription,
    {
      ...next,
      status: invoice.status === 'paid' ? 'active' : 'past_due',
      latest_invoice: invoice.id,
    },
    args.nowS
  );
}

/** Pays the subscription's open invoice with the card on file, if it can. */
export async function payOpenInvoice(
  engine: Engine,
  subscription: MockSubscription,
  nowS: number
): Promise<'paid' | 'declined' | 'nothing_due'> {
  const open = await openInvoiceOf(
    engine,
    subscription.customer,
    subscription.id
  );
  if (open === null) return 'nothing_due';
  const invoice = await attemptInvoice(engine, open, nowS);
  if (invoice.status !== 'paid') return 'declined';
  if (subscription.status === 'past_due') {
    await saveSubscription(
      engine,
      subscription,
      { ...subscription, status: 'active' },
      nowS
    );
  }
  return 'paid';
}
