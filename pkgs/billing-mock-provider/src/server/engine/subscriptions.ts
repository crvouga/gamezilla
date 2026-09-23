/**
 * The subscription lifecycle, with Stripe's semantics:
 *
 * - a trial is a $0 first invoice and a `trialing` period that ends at
 *   `trial_end`; without a trial the first charge must succeed or no
 *   subscription is created (Checkout refuses the card);
 * - at a period end the next invoice is charged: paid → `active`, declined →
 *   `past_due` with retries; a subscription set to cancel ends instead;
 * - a trial that ends with no card on file follows
 *   `trial_settings.end_behavior.missing_payment_method`: cancel, pause, or
 *   invoice anyway (and go past due);
 * - a paused subscription resumes into a fresh period, billed at once;
 * - after the last failed retry the subscription is canceled;
 * - an immediate cancel ends it now (`ended_at`), keeping its old period.
 *
 * Every save emits `customer.subscription.updated` (or `created` /
 * `deleted`), plus `paused` / `resumed` when it crossed that line.
 */
import type {
  MockCancellationDetails,
  MockEventType,
  MockInvoice,
  MockPrice,
  MockSubscription,
  MockSubscriptionStatus,
  MockTrialSettings,
} from '@pkgs/billing-mock/wire';

import { cardDeclined, invalidRequest, resourceMissing } from '../errors';
import { DAY_S, type Engine, emit, mint, previousAttributes } from './context';
import type { ChargeOutcome, ChargeSession } from './customers';
import {
  attemptInvoice,
  createInvoice,
  openInvoiceOf,
  periodLine,
} from './invoices';
import { periodEndS } from './prices';

const NO_CANCELLATION: MockCancellationDetails = {
  reason: null,
  feedback: null,
  comment: null,
};

/** Stripe's default: a trial that ends without a card cancels. */
export const DEFAULT_TRIAL_SETTINGS: MockTrialSettings = {
  end_behavior: { missing_payment_method: 'cancel' },
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

/** The invoice id, whether or not a caller expanded it. */
export function latestInvoiceId(subscription: MockSubscription): string | null {
  const latest = subscription.latest_invoice;
  return latest === null || typeof latest === 'string' ? latest : latest.id;
}

export function withPeriod(
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
  // Subscriptions stored before these fields existed carry the defaults.
  return {
    ...subscription,
    trial_settings: subscription.trial_settings ?? DEFAULT_TRIAL_SETTINGS,
    livemode: false,
  };
}

function eventTypes(
  before: MockSubscription | null,
  after: MockSubscription
): readonly MockEventType[] {
  if (before === null) return ['customer.subscription.created'];
  if (!TERMINAL.has(before.status) && TERMINAL.has(after.status)) {
    return ['customer.subscription.deleted'];
  }
  const types: MockEventType[] = ['customer.subscription.updated'];
  if (before.status !== 'paused' && after.status === 'paused') {
    types.push('customer.subscription.paused');
  }
  if (before.status === 'paused' && after.status !== 'paused') {
    types.push('customer.subscription.resumed');
  }
  return types;
}

/** Stores `after` and emits the matching subscription events. */
export async function saveSubscription(
  engine: Engine,
  before: MockSubscription | null,
  after: MockSubscription,
  nowS: number
): Promise<MockSubscription> {
  await engine.db.put(after, after.customer);
  for (const type of eventTypes(before, after)) {
    await emit(engine, {
      type,
      object: after,
      createdS: nowS,
      ...(before === null
        ? {}
        : { previous: previousAttributes(before, after) }),
    });
  }
  return after;
}

type StartArgs = {
  readonly customer: string;
  readonly price: MockPrice;
  readonly nowS: number;
  readonly trialDays: number;
  readonly trialSettings: MockTrialSettings;
  readonly metadata: Readonly<Record<string, string>>;
  readonly paymentMethod: string | null;
};

function draftSubscription(engine: Engine, args: StartArgs): MockSubscription {
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
    trial_settings: args.trialSettings,
    start_date: args.nowS,
    created: args.nowS,
    livemode: false,
    latest_invoice: null,
    default_payment_method: args.paymentMethod,
    metadata: args.metadata,
  };
}

/** Bills one period's lines and charges them. */
async function invoicePeriod(
  engine: Engine,
  subscription: MockSubscription,
  args: {
    readonly price: MockPrice;
    readonly lines: Parameters<typeof createInvoice>[1]['lines'];
    readonly reason: MockInvoice['billing_reason'];
    readonly startS: number;
    readonly endS: number;
    readonly nowS: number;
    readonly session: ChargeSession;
  }
) {
  return await attemptInvoice(
    engine,
    await createInvoice(engine, {
      customer: subscription.customer,
      subscription: subscription.id,
      currency: args.price.currency,
      lines: args.lines,
      reason: args.reason,
      periodStartS: args.startS,
      periodEndS: args.endS,
      nowS: args.nowS,
    }),
    { nowS: args.nowS, session: args.session, kind: 'scheduled' }
  );
}

/**
 * Starts a subscription, the customer present (Checkout). Without a trial
 * the first charge must go through; a declined card creates nothing (and
 * rolls the step back).
 */
export async function startSubscription(
  engine: Engine,
  args: StartArgs
): Promise<MockSubscription> {
  const draft = draftSubscription(engine, args);
  const endS = currentPeriodEnd(draft);
  const { invoice, outcome } = await invoicePeriod(engine, draft, {
    price: args.price,
    lines: [
      periodLine(engine, {
        price: args.price,
        amount: args.trialDays > 0 ? 0 : args.price.unit_amount,
        startS: args.nowS,
        endS,
      }),
    ],
    reason: 'subscription_create',
    startS: args.nowS,
    endS,
    nowS: args.nowS,
    session: 'on_session',
  });
  if (outcome !== 'succeeded' || invoice.status !== 'paid') {
    throw cardDeclined();
  }
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
  if (subscription.cancel_at_period_end === args.cancel) return subscription;
  if (subscription.status === 'paused') {
    // A pause has no running period to see out: cancel it, or resume it.
    throw invalidRequest(
      'A paused subscription has no period to cancel at the end of. Cancel it now or resume it.',
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

/**
 * Starts a new period at `price` from `startS`, billing `lines`, and settles
 * the subscription on the outcome: paid → `active`, otherwise `past_due`.
 */
export async function billPeriod(
  engine: Engine,
  subscription: MockSubscription,
  args: {
    readonly price: MockPrice;
    readonly startS: number;
    readonly lines?: Parameters<typeof createInvoice>[1]['lines'];
    readonly reason: 'subscription_cycle' | 'subscription_update';
    readonly nowS: number;
    readonly session: ChargeSession;
  }
): Promise<MockSubscription> {
  const endS = periodEndS(args.price, args.startS);
  const full = periodLine(engine, {
    price: args.price,
    amount: args.price.unit_amount,
    startS: args.startS,
    endS,
  });
  const { invoice } = await invoicePeriod(engine, subscription, {
    price: args.price,
    lines: [...(args.lines ?? []), full],
    reason: args.reason,
    startS: args.startS,
    endS,
    nowS: args.nowS,
    session: args.session,
  });
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
  args: { readonly nowS: number; readonly session: ChargeSession }
): Promise<ChargeOutcome | 'nothing_due'> {
  const open = await openInvoiceOf(
    engine,
    subscription.customer,
    subscription.id
  );
  if (open === null) return 'nothing_due';
  const { invoice, outcome } = await attemptInvoice(engine, open, {
    ...args,
    kind: 'on_demand',
  });
  if (invoice.status === 'paid' && subscription.status === 'past_due') {
    await saveSubscription(
      engine,
      subscription,
      { ...subscription, status: 'active' },
      args.nowS
    );
  }
  return outcome;
}

/** A trial ended with no card and the settings say pause. */
export async function pauseSubscription(
  engine: Engine,
  subscription: MockSubscription,
  atS: number
): Promise<MockSubscription> {
  return await saveSubscription(
    engine,
    subscription,
    { ...subscription, status: 'paused' },
    atS
  );
}

/**
 * Resumes a paused subscription: a new period starts now and is billed at
 * once (Stripe's default `billing_cycle_anchor: now`).
 */
export async function resumeSubscription(
  engine: Engine,
  subscription: MockSubscription,
  args: { readonly nowS: number; readonly session: ChargeSession }
): Promise<MockSubscription> {
  if (subscription.status !== 'paused') {
    throw invalidRequest(
      'Only a paused subscription can be resumed.',
      'subscription'
    );
  }
  return await billPeriod(engine, subscription, {
    price: priceOf(subscription),
    startS: args.nowS,
    reason: 'subscription_cycle',
    nowS: args.nowS,
    session: args.session,
  });
}
