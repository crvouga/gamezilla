/**
 * Invoices and payment attempts, with Stripe's invoice lifecycle: created as a
 * draft, finalized (numbered, the customer's balance applied), then paid or
 * left open. A failed charge schedules Smart-Retries-style retries; the caller
 * decides what the subscription does about it.
 */
import type {
  MockInvoice,
  MockInvoiceLine,
  MockPrice,
} from '@pkgs/billing-mock/wire';

import { resourceMissing } from '../errors';
import { DAY_S, type Engine, emit, mint } from './context';
import {
  adjustBalance,
  type ChargeOutcome,
  type ChargeSession,
  charge,
  requireCustomer,
} from './customers';

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

function priceName(price: MockPrice): string {
  return price.nickname ?? price.lookup_key ?? price.id;
}

/** A line for one full period at `price`. */
export function periodLine(
  engine: Engine,
  args: {
    readonly price: MockPrice;
    readonly amount: number;
    readonly startS: number;
    readonly endS: number;
  }
): MockInvoiceLine {
  return {
    id: mint(engine, 'il'),
    object: 'line_item',
    description: `1 × ${priceName(args.price)} (per ${args.price.recurring.interval})`,
    amount: args.amount,
    price: args.price.id,
    proration: false,
    period: { start: args.startS, end: args.endS },
  };
}

/** A proration credit for the unused rest of a period at `price`. */
export function unusedTimeLine(
  engine: Engine,
  args: {
    readonly price: MockPrice;
    readonly credit: number;
    readonly fromS: number;
    readonly endS: number;
  }
): MockInvoiceLine {
  return {
    id: mint(engine, 'il'),
    object: 'line_item',
    description: `Unused time on ${priceName(args.price)}`,
    amount: -args.credit,
    price: args.price.id,
    proration: true,
    period: { start: args.fromS, end: args.endS },
  };
}

async function invoiceNumber(
  engine: Engine,
  customer: string
): Promise<string> {
  const numbered = (
    await engine.db.list<MockInvoice>('invoice', customer)
  ).filter((invoice) => invoice.number !== null);
  const prefix = customer.slice(-8).toUpperCase();
  return `${prefix}-${String(numbered.length + 1).padStart(4, '0')}`;
}

/**
 * A new invoice for one subscription period, finalized: numbered, with the
 * customer's balance applied (credit first, the rest due) — before any
 * payment attempt.
 */
export async function createInvoice(
  engine: Engine,
  args: {
    readonly customer: string;
    readonly subscription: string;
    readonly currency: string;
    readonly lines: readonly MockInvoiceLine[];
    readonly reason: MockInvoice['billing_reason'];
    readonly periodStartS: number;
    readonly periodEndS: number;
    readonly nowS: number;
  }
): Promise<MockInvoice> {
  const total = args.lines.reduce((sum, line) => sum + line.amount, 0);
  const startingBalance = (await requireCustomer(engine, args.customer))
    .balance;
  const net = total + startingBalance;
  const draft: MockInvoice = {
    id: mint(engine, 'in'),
    object: 'invoice',
    customer: args.customer,
    subscription: args.subscription,
    status: 'draft',
    billing_reason: args.reason,
    currency: args.currency,
    subtotal: total,
    total,
    starting_balance: startingBalance,
    ending_balance: Math.min(0, net),
    number: null,
    attempted: false,
    amount_due: Math.max(0, net),
    amount_paid: 0,
    amount_remaining: Math.max(0, net),
    attempt_count: 0,
    next_payment_attempt: null,
    period_start: args.periodStartS,
    period_end: args.periodEndS,
    lines: {
      object: 'list',
      has_more: false,
      url: '/v1/invoices/lines',
      data: args.lines,
    },
    created: args.nowS,
    livemode: false,
  };
  await emit(engine, {
    type: 'invoice.created',
    object: draft,
    createdS: args.nowS,
  });
  const finalized: MockInvoice = {
    ...draft,
    status: 'open',
    number: await invoiceNumber(engine, args.customer),
  };
  await engine.db.put(finalized, args.customer);
  await adjustBalance(engine, args.customer, {
    balance: finalized.ending_balance,
    nowS: args.nowS,
  });
  await emit(engine, {
    type: 'invoice.finalized',
    object: finalized,
    createdS: args.nowS,
  });
  return finalized;
}

/**
 * Whether an attempt is one of the automatic ones (the first, when the
 * invoice is finalized, and each retry) or an extra one someone asked for —
 * paying from the portal or `POST /v1/invoices/:id/pay`. Only automatic
 * attempts move the retry schedule; a manual one leaves it where it was.
 */
export type AttemptKind = 'scheduled' | 'on_demand';

function nextAttemptS(invoice: MockInvoice, kind: AttemptKind): number | null {
  if (kind === 'on_demand') return invoice.next_payment_attempt;
  const schedule = RETRY_AFTER_DAYS.map(
    (days) => invoice.created + days * DAY_S
  );
  if (!invoice.attempted) return schedule[0] ?? null;
  const current = invoice.next_payment_attempt;
  if (current === null) return null;
  return schedule[schedule.indexOf(current) + 1] ?? null;
}

export type InvoiceAttempt = {
  readonly invoice: MockInvoice;
  readonly outcome: ChargeOutcome;
};

async function markPaid(
  engine: Engine,
  invoice: MockInvoice,
  nowS: number
): Promise<MockInvoice> {
  const paid: MockInvoice = {
    ...invoice,
    status: 'paid',
    attempted: true,
    amount_paid: invoice.amount_due,
    amount_remaining: 0,
    next_payment_attempt: null,
  };
  await engine.db.put(paid, invoice.customer);
  await emit(engine, { type: 'invoice.paid', object: paid, createdS: nowS });
  await emit(engine, {
    type: 'invoice.payment_succeeded',
    object: paid,
    createdS: nowS,
  });
  return paid;
}

/**
 * Charges the customer's default card for an open `invoice`. A zero invoice
 * (a trial, or one covered by credit) is paid without a charge. A charge
 * nobody is present to authenticate fails with `authentication_required`
 * (`invoice.payment_action_required`) rather than a decline.
 */
export async function attemptInvoice(
  engine: Engine,
  invoice: MockInvoice,
  args: {
    readonly nowS: number;
    readonly session: ChargeSession;
    readonly kind: AttemptKind;
  }
): Promise<InvoiceAttempt> {
  if (invoice.status !== 'open') return { invoice, outcome: 'succeeded' };
  if (invoice.amount_due === 0) {
    return {
      invoice: await markPaid(engine, invoice, args.nowS),
      outcome: 'succeeded',
    };
  }
  const outcome = await charge(engine, invoice.customer, args.session);
  const attempts = invoice.attempt_count + 1;
  if (outcome === 'succeeded') {
    return {
      invoice: await markPaid(
        engine,
        { ...invoice, attempt_count: attempts },
        args.nowS
      ),
      outcome,
    };
  }
  const failed: MockInvoice = {
    ...invoice,
    attempted: true,
    attempt_count: attempts,
    next_payment_attempt: nextAttemptS(invoice, args.kind),
  };
  await engine.db.put(failed, invoice.customer);
  await emit(engine, {
    type:
      outcome === 'authentication_required'
        ? 'invoice.payment_action_required'
        : 'invoice.payment_failed',
    object: failed,
    createdS: args.nowS,
  });
  return { invoice: failed, outcome };
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
