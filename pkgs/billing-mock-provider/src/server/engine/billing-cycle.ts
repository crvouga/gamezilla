/**
 * Time-driven billing: trial reminders, trial ends, renewals at period ends,
 * dunning retries and the endings they lead to, and expiring checkout
 * sessions — plus price switches, which move a period.
 *
 * Every customer bills on its own test clock. {@link settleCustomer} catches a
 * customer up to that clock, one due step at a time in chronological order,
 * so advancing a clock a month through a failed renewal and three retries
 * emits the same events, in the same order, as living through it.
 */
import type {
  MockCheckoutSession,
  MockPrice,
  MockSubscription,
} from '@pkgs/billing-mock/wire';

import { invalidRequest } from '../errors';
import { customerNowS, DAY_S, type Engine, emit } from './context';
import { type ChargeSession, defaultPaymentMethod } from './customers';
import {
  attemptInvoice,
  openInvoiceOf,
  RETRY_AFTER_DAYS,
  unusedTimeLine,
} from './invoices';
import { expireCheckoutSession } from './sessions';
import {
  billPeriod,
  currentPeriodEnd,
  endSubscription,
  pauseSubscription,
  priceOf,
  saveSubscription,
  TERMINAL,
} from './subscriptions';

/** A step the customer owes at `atS`. */
type DueStep = {
  readonly atS: number;
  readonly run: () => Promise<void>;
};

/** Stripe sends `trial_will_end` three days before a trial ends. */
const TRIAL_REMINDER_S = 3 * DAY_S;

/** The marker that a subscription's trial reminder went out. */
type TrialReminder = { readonly id: string; readonly object: 'reminder' };

function reminderId(subscription: MockSubscription): string {
  return `twe_${subscription.id}_${String(subscription.trial_end)}`;
}

async function trialReminderStep(
  engine: Engine,
  subscription: MockSubscription
): Promise<DueStep | null> {
  const trialEnd = subscription.trial_end;
  if (subscription.status !== 'trialing' || trialEnd === null) return null;
  const id = reminderId(subscription);
  if ((await engine.db.get<TrialReminder>(id, 'reminder')) !== null) {
    return null;
  }
  const atS = Math.max(
    subscription.trial_start ?? subscription.created,
    trialEnd - TRIAL_REMINDER_S
  );
  return {
    atS,
    run: async () => {
      await engine.db.put<TrialReminder>(
        { id, object: 'reminder' },
        subscription.customer
      );
      await emit(engine, {
        type: 'customer.subscription.trial_will_end',
        object: subscription,
        createdS: atS,
      });
    },
  };
}

/** A trial ending with no card on file, per the subscription's settings. */
async function trialEndWithoutCard(
  engine: Engine,
  subscription: MockSubscription,
  endS: number
): Promise<boolean> {
  if (subscription.status !== 'trialing') return false;
  if ((await defaultPaymentMethod(engine, subscription.customer)) !== null) {
    return false;
  }
  const behavior =
    subscription.trial_settings.end_behavior.missing_payment_method;
  if (behavior === 'cancel') {
    await endSubscription(engine, subscription, {
      endedAtS: endS,
      reason: null,
    });
    return true;
  }
  if (behavior === 'pause') {
    await pauseSubscription(engine, subscription, endS);
    return true;
  }
  return false;
}

function renewalStep(
  engine: Engine,
  subscription: MockSubscription
): DueStep | null {
  const endS = currentPeriodEnd(subscription);
  if (subscription.cancel_at_period_end) {
    return {
      atS: endS,
      run: async () => {
        await endSubscription(engine, subscription, {
          endedAtS: endS,
          reason: 'cancellation_requested',
        });
      },
    };
  }
  if (subscription.status !== 'trialing' && subscription.status !== 'active') {
    return null;
  }
  return {
    atS: endS,
    run: async () => {
      if (await trialEndWithoutCard(engine, subscription, endS)) return;
      await billPeriod(engine, subscription, {
        price: priceOf(subscription),
        startS: endS,
        reason: 'subscription_cycle',
        nowS: endS,
        session: 'off_session',
      });
    },
  };
}

async function retryStep(
  engine: Engine,
  subscription: MockSubscription
): Promise<DueStep | null> {
  const invoice = await openInvoiceOf(
    engine,
    subscription.customer,
    subscription.id
  );
  if (invoice === null) return null;
  const atS = invoice.next_payment_attempt;
  if (atS === null) {
    // Every retry failed: give up on the subscription (the default setting).
    const lastRetryS = invoice.created + (RETRY_AFTER_DAYS.at(-1) ?? 0) * DAY_S;
    const endedAtS = Math.min(
      lastRetryS,
      await customerNowS(engine, subscription.customer)
    );
    return {
      atS: endedAtS,
      run: async () => {
        await endSubscription(engine, subscription, {
          endedAtS,
          reason: 'payment_failed',
        });
      },
    };
  }
  return {
    atS,
    run: async () => {
      const { invoice: paid } = await attemptInvoice(engine, invoice, {
        nowS: atS,
        session: 'off_session',
        kind: 'scheduled',
      });
      if (paid.status === 'paid') {
        await saveSubscription(
          engine,
          subscription,
          { ...subscription, status: 'active' },
          atS
        );
      }
    },
  };
}

async function subscriptionSteps(
  engine: Engine,
  subscription: MockSubscription
): Promise<readonly (DueStep | null)[]> {
  if (TERMINAL.has(subscription.status)) return [];
  if (subscription.status === 'past_due') {
    return [await retryStep(engine, subscription)];
  }
  return [
    await trialReminderStep(engine, subscription),
    renewalStep(engine, subscription),
  ];
}

function expiryStep(
  engine: Engine,
  session: MockCheckoutSession
): DueStep | null {
  if (session.status !== 'open') return null;
  return {
    atS: session.expires_at,
    run: async () => {
      await expireCheckoutSession(engine, session, session.expires_at);
    },
  };
}

async function nextDueStep(
  engine: Engine,
  customer: string,
  nowS: number
): Promise<DueStep | null> {
  const steps: (DueStep | null)[] = [];
  for (const subscription of await engine.db.list<MockSubscription>(
    'subscription',
    customer
  )) {
    steps.push(...(await subscriptionSteps(engine, subscription)));
  }
  for (const session of await engine.db.list<MockCheckoutSession>(
    'checkout.session',
    customer
  )) {
    steps.push(expiryStep(engine, session));
  }
  let next: DueStep | null = null;
  for (const step of steps) {
    if (step === null || step.atS > nowS) continue;
    if (next === null || step.atS < next.atS) next = step;
  }
  return next;
}

/** A bound on steps per settle: years of monthly renewals and retries. */
const MAX_STEPS = 256;

/** Catches the customer up to the customer's clock. */
export async function settleCustomer(
  engine: Engine,
  customer: string
): Promise<void> {
  const nowS = await customerNowS(engine, customer);
  for (let step = 0; step < MAX_STEPS; step += 1) {
    const due = await nextDueStep(engine, customer, nowS);
    if (due === null) return;
    await due.run();
  }
}

/** Unused time on the current period, as a credit in minor units. */
function unusedCredit(subscription: MockSubscription, nowS: number): number {
  const item = subscription.items.data[0];
  if (item === undefined) return 0;
  const total = item.current_period_end - item.current_period_start;
  const left = Math.max(0, item.current_period_end - nowS);
  return total <= 0 ? 0 : Math.round((item.price.unit_amount * left) / total);
}

export type ProrationBehavior = 'create_prorations' | 'always_invoice' | 'none';

function swapPrice(
  subscription: MockSubscription,
  price: MockPrice
): MockSubscription {
  const item = subscription.items.data[0];
  return {
    ...subscription,
    items: {
      ...subscription.items,
      data: item === undefined ? [] : [{ ...item, price }],
    },
  };
}

/**
 * Moves the subscription to `price`. During a trial (or a pause) the period
 * carries on at the new price; otherwise the new interval restarts the
 * period now and is invoiced at once, less a proration credit for the unused
 * time (unless `proration_behavior` is `none`). Credit beyond the new price
 * stays on the customer's balance for later invoices.
 */
export async function switchPrice(
  engine: Engine,
  subscription: MockSubscription,
  args: {
    readonly price: MockPrice;
    readonly nowS: number;
    readonly proration: ProrationBehavior;
    readonly session: ChargeSession;
  }
): Promise<MockSubscription> {
  if (TERMINAL.has(subscription.status)) {
    throw invalidRequest(
      'A canceled subscription cannot change price.',
      'items'
    );
  }
  const current = priceOf(subscription);
  if (current.id === args.price.id) return subscription;
  if (subscription.status === 'trialing' || subscription.status === 'paused') {
    return await saveSubscription(
      engine,
      subscription,
      swapPrice(subscription, args.price),
      args.nowS
    );
  }
  const credit =
    args.proration === 'none' ? 0 : unusedCredit(subscription, args.nowS);
  return await billPeriod(engine, subscription, {
    price: args.price,
    startS: args.nowS,
    lines:
      credit > 0
        ? [
            unusedTimeLine(engine, {
              price: current,
              credit,
              fromS: args.nowS,
              endS: currentPeriodEnd(subscription),
            }),
          ]
        : [],
    reason: 'subscription_update',
    nowS: args.nowS,
    session: args.session,
  });
}
