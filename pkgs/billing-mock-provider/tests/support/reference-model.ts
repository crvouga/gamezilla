/**
 * A small reference model of Stripe's subscription lifecycle for one
 * customer, written from Stripe's documented rules rather than from the
 * provider's code: trials, calendar-month renewals, Smart-Retries dunning
 * (3, 5, 7 days, then cancel), cancel at period end, immediate cancel, price
 * switches with proration credit carried on the customer's balance, trials
 * that end without a card, pause and resume, and 3D Secure cards that pass
 * on-session and fail off-session.
 *
 * The property test runs the same random operations against the model and
 * the provider and requires them to agree after every step.
 */
import type { Membership } from '@pkgs/billing';
import type { MockSubscriptionStatus } from '@pkgs/billing-mock';

export const DAY_S = 86_400;
const RETRY_DAYS = [3, 5, 7] as const;
const TRIAL_DAYS = 7;

export type Card = 'visa' | 'fails' | 'declined' | 'sca';
export type PriceKey = 'monthly' | 'yearly';
export type MissingCard = 'cancel' | 'pause' | 'create_invoice';

export const PRICE: Readonly<Record<PriceKey, number>> = {
  monthly: 700,
  yearly: 6000,
};

export type ModelStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'paused'
  | 'canceled';

export type ModelInvoice = {
  readonly createdS: number;
  /** Automatic attempts only; a manual payment leaves the schedule alone. */
  attempts: number;
  paid: boolean;
};

export type ModelSubscription = {
  readonly index: number;
  status: ModelStatus;
  price: PriceKey;
  periodStartS: number;
  periodEndS: number;
  cancelAtPeriodEnd: boolean;
  endedAtS: number | null;
  readonly missingCard: MissingCard;
  readonly invoices: ModelInvoice[];
};

/** A calendar interval later, clamped to the month's last day. */
export function addInterval(price: PriceKey, startS: number): number {
  const start = new Date(startS * 1000);
  const months = price === 'yearly' ? 12 : 1;
  const target = start.getUTCMonth() + months;
  const days = new Date(
    Date.UTC(start.getUTCFullYear(), target + 1, 0)
  ).getUTCDate();
  return (
    Date.UTC(
      start.getUTCFullYear(),
      target,
      Math.min(start.getUTCDate(), days),
      start.getUTCHours(),
      start.getUTCMinutes(),
      start.getUTCSeconds()
    ) / 1000
  );
}

type Session = 'on' | 'off';

function charges(card: Card | null, session: Session): boolean {
  if (card === 'visa') return true;
  return card === 'sca' && session === 'on';
}

export class ReferenceModel {
  nowS: number;
  card: Card | null = null;
  balance = 0;
  readonly subscriptions: ModelSubscription[] = [];

  constructor(nowS: number) {
    this.nowS = nowS;
  }

  live(): ModelSubscription | null {
    return this.subscriptions.find((s) => s.status !== 'canceled') ?? null;
  }

  /** Newest open invoice, the one retries and payments act on. */
  openInvoice(sub: ModelSubscription): ModelInvoice | null {
    return sub.invoices.filter((invoice) => !invoice.paid).at(-1) ?? null;
  }

  /** Finalizes one invoice against the balance and attempts it. */
  private invoice(total: number, session: Session): ModelInvoice {
    const net = total + this.balance;
    this.balance = Math.min(0, net);
    const due = Math.max(0, net);
    const invoice: ModelInvoice = {
      createdS: this.nowS,
      attempts: 0,
      paid: false,
    };
    if (due === 0) invoice.paid = true;
    else {
      invoice.attempts = 1;
      invoice.paid = charges(this.card, session);
    }
    return invoice;
  }

  /** Checkout; returns false when it is refused (nothing changes). */
  checkout(args: {
    readonly card: Card | null;
    readonly price: PriceKey;
    readonly trial: boolean;
    readonly missingCard: MissingCard;
  }): boolean {
    if (args.card === 'declined') return false;
    const net = PRICE[args.price] + this.balance;
    if (!args.trial && net > 0 && !charges(args.card, 'on')) return false;
    if (args.card !== null) this.card = args.card;
    const sub: ModelSubscription = {
      index: this.subscriptions.length,
      status: args.trial ? 'trialing' : 'active',
      price: args.price,
      periodStartS: this.nowS,
      periodEndS: args.trial
        ? this.nowS + TRIAL_DAYS * DAY_S
        : addInterval(args.price, this.nowS),
      cancelAtPeriodEnd: false,
      endedAtS: null,
      missingCard: args.missingCard,
      invoices: [],
    };
    sub.invoices.push(this.invoice(args.trial ? 0 : PRICE[args.price], 'on'));
    this.subscriptions.push(sub);
    return true;
  }

  private startPeriod(
    sub: ModelSubscription,
    lines: number,
    session: Session
  ): void {
    const invoice = this.invoice(lines, session);
    sub.invoices.push(invoice);
    sub.periodStartS = this.nowS;
    sub.periodEndS = addInterval(sub.price, this.nowS);
    sub.status = invoice.paid ? 'active' : 'past_due';
  }

  private end(sub: ModelSubscription, atS: number): void {
    sub.status = 'canceled';
    sub.cancelAtPeriodEnd = false;
    sub.endedAtS = atS;
  }

  /** The next step owed at or before `untilS`, run; false when none. */
  private step(sub: ModelSubscription, untilS: number): boolean {
    if (sub.status === 'canceled') return false;
    if (sub.status === 'past_due') return this.retry(sub, untilS);
    if (sub.periodEndS > untilS) return false;
    const endS = sub.periodEndS;
    if (sub.cancelAtPeriodEnd) {
      this.nowS = endS;
      this.end(sub, endS);
      return true;
    }
    if (sub.status === 'paused') return false;
    this.nowS = endS;
    if (sub.status === 'trialing' && this.card === null) {
      if (sub.missingCard === 'cancel') {
        this.end(sub, endS);
        return true;
      }
      if (sub.missingCard === 'pause') {
        sub.status = 'paused';
        return true;
      }
    }
    this.startPeriodAt(sub, endS);
    return true;
  }

  private startPeriodAt(sub: ModelSubscription, startS: number): void {
    this.nowS = startS;
    this.startPeriod(sub, PRICE[sub.price], 'off');
  }

  private retry(sub: ModelSubscription, untilS: number): boolean {
    const invoice = this.openInvoice(sub);
    if (invoice === null) return false;
    const days = RETRY_DAYS[invoice.attempts - 1];
    const lastS = invoice.createdS + (RETRY_DAYS.at(-1) ?? 0) * DAY_S;
    if (days === undefined) {
      const atS = Math.min(lastS, untilS);
      this.nowS = atS;
      this.end(sub, atS);
      return true;
    }
    const atS = invoice.createdS + days * DAY_S;
    if (atS > untilS) return false;
    this.nowS = atS;
    invoice.attempts += 1;
    invoice.paid = charges(this.card, 'off');
    if (invoice.paid) sub.status = 'active';
    return true;
  }

  /** Lives through time up to `untilS`, one due step at a time. */
  advanceTo(untilS: number): void {
    for (let guard = 0; guard < 512; guard += 1) {
      const sub = this.live();
      if (sub === null || !this.step(sub, untilS)) break;
    }
    this.nowS = untilS;
  }

  setCard(card: Card): boolean {
    if (card === 'declined') return false;
    this.card = card;
    return true;
  }

  /** Portal: new card, then the open invoice on-session. */
  portalPay(card: Card): boolean {
    if (!this.setCard(card)) return false;
    const sub = this.live();
    if (sub === null) return true;
    return this.pay(sub, 'on');
  }

  /** Pays the newest open invoice; false when the charge fails. */
  pay(sub: ModelSubscription, session: Session): boolean {
    const invoice = this.openInvoice(sub);
    if (invoice === null) return true;
    invoice.paid = charges(this.card, session);
    if (invoice.paid && sub.status === 'past_due') sub.status = 'active';
    return invoice.paid;
  }

  cancelNow(sub: ModelSubscription): void {
    this.end(sub, this.nowS);
  }

  resume(sub: ModelSubscription): void {
    this.startPeriod(sub, PRICE[sub.price], 'off');
  }

  switchPrice(sub: ModelSubscription, prorate: boolean): void {
    const next: PriceKey = sub.price === 'monthly' ? 'yearly' : 'monthly';
    if (sub.status === 'trialing' || sub.status === 'paused') {
      sub.price = next;
      return;
    }
    const total = sub.periodEndS - sub.periodStartS;
    const left = Math.max(0, sub.periodEndS - this.nowS);
    const credit =
      !prorate || total <= 0
        ? 0
        : Math.round((PRICE[sub.price] * left) / total);
    sub.price = next;
    this.startPeriod(sub, PRICE[next] - credit, 'off');
  }
}

/** What the adapter must report for a model subscription right now. */
export function expectedMembership(sub: ModelSubscription): Membership {
  const periodEndMs = sub.periodEndS * 1000;
  if (sub.status === 'canceled' || sub.status === 'paused') {
    const endedMs = sub.endedAtS === null ? null : sub.endedAtS * 1000;
    return {
      status: 'ended',
      periodEndMs:
        endedMs === null ? periodEndMs : Math.min(periodEndMs, endedMs),
      endsAtPeriodEnd: false,
    };
  }
  return {
    status: sub.status === 'past_due' ? 'delinquent' : sub.status,
    periodEndMs,
    endsAtPeriodEnd: sub.cancelAtPeriodEnd,
  };
}

/** The wire status a model status is reported as. */
export const WIRE_STATUS: Readonly<
  Record<ModelStatus, MockSubscriptionStatus>
> = {
  trialing: 'trialing',
  active: 'active',
  past_due: 'past_due',
  paused: 'paused',
  canceled: 'canceled',
};
