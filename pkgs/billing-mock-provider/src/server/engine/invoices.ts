/**
 * Invoices and payment attempts. A failed charge leaves the invoice open and
 * schedules Smart-Retries-style retries; the caller decides what the
 * subscription does about it.
 */
import type { MockInvoice, MockPrice } from '@pkgs/billing-mock/wire';

import { resourceMissing } from '../errors';
import { DAY_S, type Engine, emit, mint } from './context';
import { chargeSucceeds } from './customers';

/** Retries after the first failure, in days; after the last, give up. */
export const RETRY_AFTER_DAYS = [3, 5, 7] as const;

export async function requireInvoice(
  engine: Engine,
  id: string
): Promise<MockInvoice> {
  const invoice = await engine.db.get<MockInvoice>(id, 'invoice');
  if (invoice === null) throw resourceMissing('invoice', id);
  return invoice;
}

function describe(price: MockPrice, reason: MockInvoice['billing_reason']) {
  const name = price.nickname ?? price.lookup_key ?? price.id;
  if (reason === 'subscription_update') return `Remaining time on ${name}`;
  return `1 × ${name} (per ${price.recurring.interval})`;
}

/** A new invoice for one subscription period, before any payment attempt. */
export async function createInvoice(
  engine: Engine,
  args: {
    readonly customer: string;
    readonly subscription: string;
    readonly price: MockPrice;
    readonly amount: number;
    readonly reason: MockInvoice['billing_reason'];
    readonly periodStartS: number;
    readonly periodEndS: number;
    readonly nowS: number;
  }
): Promise<MockInvoice> {
  const invoice: MockInvoice = {
    id: mint(engine, 'in'),
    object: 'invoice',
    customer: args.customer,
    subscription: args.subscription,
    status: 'draft',
    billing_reason: args.reason,
    currency: args.price.currency,
    amount_due: args.amount,
    amount_paid: 0,
    amount_remaining: args.amount,
    attempt_count: 0,
    next_payment_attempt: null,
    period_start: args.periodStartS,
    period_end: args.periodEndS,
    lines: {
      object: 'list',
      has_more: false,
      url: '/v1/invoices/lines',
      data: [
        {
          description: describe(args.price, args.reason),
          amount: args.amount,
          price: args.price.id,
        },
      ],
    },
    created: args.nowS,
  };
  await emit(engine, {
    type: 'invoice.created',
    object: invoice,
    createdS: args.nowS,
  });
  return invoice;
}

function nextAttemptS(invoice: MockInvoice, attempts: number): number | null {
  const days = RETRY_AFTER_DAYS[attempts - 1];
  return days === undefined ? null : invoice.created + days * DAY_S;
}

/**
 * Charges the customer's default card for `invoice`. A zero invoice (a
 * trial) is paid without a charge. Returns the invoice as it now stands.
 */
export async function attemptInvoice(
  engine: Engine,
  invoice: MockInvoice,
  nowS: number
): Promise<MockInvoice> {
  const paid =
    invoice.amount_due === 0 ||
    (await chargeSucceeds(engine, invoice.customer));
  const attempts = invoice.attempt_count + (invoice.amount_due === 0 ? 0 : 1);
  const next: MockInvoice = paid
    ? {
        ...invoice,
        status: 'paid',
        amount_paid: invoice.amount_due,
        amount_remaining: 0,
        attempt_count: attempts,
        next_payment_attempt: null,
      }
    : {
        ...invoice,
        status: 'open',
        attempt_count: attempts,
        next_payment_attempt: nextAttemptS(invoice, attempts),
      };
  await engine.db.put(next, invoice.customer);
  await emit(engine, {
    type: paid ? 'invoice.paid' : 'invoice.payment_failed',
    object: next,
    createdS: nowS,
  });
  return next;
}

/** The subscription's unpaid invoice, if it is waiting on one. */
export async function openInvoiceOf(
  engine: Engine,
  customer: string,
  subscription: string
): Promise<MockInvoice | null> {
  const invoices = await engine.db.list<MockInvoice>('invoice', customer);
  return (
    invoices.find(
      (invoice) =>
        invoice.subscription === subscription && invoice.status === 'open'
    ) ?? null
  );
}
