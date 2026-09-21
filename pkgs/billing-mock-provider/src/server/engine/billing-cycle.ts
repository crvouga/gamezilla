/**
 * Time-driven billing: renewals at period ends, dunning retries, and the
 * endings both lead to — plus price switches, which move a period.
 *
 * Every customer bills on its own test clock. {@link settleCustomer} catches a
 * customer's subscriptions up to that clock, one due step at a time in
 * chronological order, so advancing a clock a month through a failed renewal
 * and three retries emits the same events, in the same order, as living
 * through it.
 */
import type { MockPrice, MockSubscription } from '@pkgs/billing-mock/wire';

import { invalidRequest } from '../errors';
import { customerNowS, DAY_S, type Engine } from './context';
import { attemptInvoice, openInvoiceOf, RETRY_AFTER_DAYS } from './invoices';
import {
  billPeriod,
  currentPeriodEnd,
  endSubscription,
  priceOf,
  saveSubscription,
  TERMINAL,
} from './subscriptions';

/** A step a subscription owes at `atS`. */
type DueStep = {
  readonly atS: number;
  readonly run: () => Promise<void>;
};

async function renewalStep(
  engine: Engine,
  subscription: MockSubscription
): Promise<DueStep | null> {
  const endS = currentPeriodEnd(subscription);
  const billable =
    subscription.status === 'trialing' || subscription.status === 'active';
  if (subscription.cancel_at_period_end && !TERMINAL.has(subscription.status)) {
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
  if (!billable) return null;
  return {
    atS: endS,
    run: async () => {
      const price = priceOf(subscription);
      await billPeriod(engine, subscription, {
        price,
        startS: endS,
        amount: price.unit_amount,
        reason: 'subscription_cycle',
        nowS: endS,
      });
    },
  };
}

async function retryStep(
  engine: Engine,
  subscription: MockSubscription
): Promise<DueStep | null> {
  if (subscription.status !== 'past_due') return null;
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
      const paid = await attemptInvoice(engine, invoice, atS);
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

async function nextDueStep(
  engine: Engine,
  customer: string,
  nowS: number
): Promise<DueStep | null> {
  let next: DueStep | null = null;
  const subscriptions = await engine.db.list<MockSubscription>(
    'subscription',
    customer
  );
  for (const subscription of subscriptions) {
    if (TERMINAL.has(subscription.status)) continue;
    const step =
      subscription.status === 'past_due'
        ? await retryStep(engine, subscription)
        : await renewalStep(engine, subscription);
    if (
      step !== null &&
      step.atS <= nowS &&
      (next === null || step.atS < next.atS)
    ) {
      next = step;
    }
  }
  return next;
}

/** A bound on steps per settle: a year of monthly renewals and retries. */
const MAX_STEPS = 64;

/** Catches the customer's subscriptions up to the customer's clock. */
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

/**
 * Moves the subscription to `price`. During a trial the trial carries on at
 * the new price; otherwise the period restarts now and the new price, minus
 * credit for unused time, is charged at once.
 */
export async function switchPrice(
  engine: Engine,
  subscription: MockSubscription,
  args: { readonly price: MockPrice; readonly nowS: number }
): Promise<MockSubscription> {
  if (TERMINAL.has(subscription.status)) {
    throw invalidRequest(
      'A canceled subscription cannot change price.',
      'items'
    );
  }
  const current = priceOf(subscription);
  if (current.id === args.price.id) return subscription;
  if (subscription.status === 'trialing') {
    const item = subscription.items.data[0];
    return await saveSubscription(
      engine,
      subscription,
      {
        ...subscription,
        items: {
          ...subscription.items,
          data: item === undefined ? [] : [{ ...item, price: args.price }],
        },
      },
      args.nowS
    );
  }
  return await billPeriod(engine, subscription, {
    price: args.price,
    startS: args.nowS,
    amount: Math.max(
      0,
      args.price.unit_amount - unusedCredit(subscription, args.nowS)
    ),
    reason: 'subscription_update',
    nowS: args.nowS,
  });
}
