/**
 * What the hosted pages see and do. Each read settles the customer first, so
 * a page always shows the subscription as of the customer's clock.
 */
import type {
  MockCheckoutSession,
  MockInvoice,
  MockPrice,
  MockSubscription,
} from '@pkgs/billing-mock/wire';

import type {
  CheckoutView,
  PageBusiness,
  PagePrice,
  PortalAction,
  PortalInvoice,
  PortalSubscription,
  PortalView,
} from '../../shared/pages';
import { invalidRequest } from '../errors';
import { settleCustomer, switchPrice } from './billing-cycle';
import { customerNowS, type Engine } from './context';
import { attachDefaultPaymentMethod, defaultPaymentMethod } from './customers';
import { openInvoiceOf } from './invoices';
import { switchablePrices } from './prices';
import { checkoutPrices, requirePortalSession } from './sessions';
import {
  currentPeriodEnd,
  payOpenInvoice,
  priceOf,
  requireSubscription,
  setCancelAtPeriodEnd,
  TERMINAL,
} from './subscriptions';

function business(engine: Engine): PageBusiness {
  const { catalog } = engine.deps;
  return {
    name: catalog.businessName,
    product: {
      name: catalog.product.name,
      description: catalog.product.description,
    },
  };
}

function pagePrice(price: MockPrice): PagePrice {
  return {
    id: price.id,
    lookupKey: price.lookup_key,
    nickname: price.nickname,
    interval: price.recurring.interval,
    unitAmount: price.unit_amount,
    currency: price.currency,
  };
}

export async function checkoutView(
  engine: Engine,
  session: MockCheckoutSession
): Promise<CheckoutView> {
  const prices = await checkoutPrices(engine, session);
  return {
    business: business(engine),
    session: {
      id: session.id,
      status: session.status,
      successUrl: session.success_url,
      cancelUrl: session.cancel_url,
      trialPeriodDays: session.subscription_data.trial_period_days,
    },
    prices: prices.map(pagePrice),
    selectedPriceId: prices[0]?.id ?? '',
    nowMs: (await customerNowS(engine, session.customer)) * 1000,
  };
}

function msOrNull(seconds: number | null): number | null {
  return seconds === null ? null : seconds * 1000;
}

async function portalSubscription(
  engine: Engine,
  subscription: MockSubscription
): Promise<PortalSubscription> {
  const open = await openInvoiceOf(
    engine,
    subscription.customer,
    subscription.id
  );
  return {
    id: subscription.id,
    status: subscription.status,
    priceId: priceOf(subscription).id,
    currentPeriodEndMs: currentPeriodEnd(subscription) * 1000,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    trialEndMs: msOrNull(subscription.trial_end),
    endedAtMs: msOrNull(subscription.ended_at),
    openInvoice:
      open === null
        ? null
        : {
            id: open.id,
            amountDue: open.amount_remaining,
            currency: open.currency,
            nextAttemptMs: msOrNull(open.next_payment_attempt),
          },
  };
}

function portalInvoice(invoice: MockInvoice): PortalInvoice {
  return {
    id: invoice.id,
    createdMs: invoice.created * 1000,
    status: invoice.status,
    amountDue: invoice.amount_due,
    amountPaid: invoice.amount_paid,
    currency: invoice.currency,
    description: invoice.lines.data[0]?.description ?? 'Subscription',
  };
}

/** The live subscription, else the most recent one. */
async function focusSubscription(
  engine: Engine,
  customer: string
): Promise<MockSubscription | null> {
  const all = await engine.db.list<MockSubscription>('subscription', customer);
  return (
    all.find((candidate) => !TERMINAL.has(candidate.status)) ?? all[0] ?? null
  );
}

export async function portalView(
  engine: Engine,
  sessionId: string
): Promise<PortalView> {
  const session = await requirePortalSession(engine, sessionId);
  await settleCustomer(engine, session.customer);
  const subscription = await focusSubscription(engine, session.customer);
  const method = await defaultPaymentMethod(engine, session.customer);
  const invoices = await engine.db.list<MockInvoice>(
    'invoice',
    session.customer
  );
  return {
    business: business(engine),
    returnUrl: session.return_url,
    prices: (await switchablePrices(engine)).map(pagePrice),
    subscription:
      subscription === null
        ? null
        : await portalSubscription(engine, subscription),
    paymentMethod: method?.card ?? null,
    invoices: invoices
      .filter((invoice) => invoice.status !== 'draft')
      .map(portalInvoice),
    cancellationReasons: engine.deps.catalog.portal.cancellationReasons,
    nowMs: (await customerNowS(engine, session.customer)) * 1000,
  };
}

async function liveSubscription(
  engine: Engine,
  customer: string
): Promise<MockSubscription> {
  const subscription = await focusSubscription(engine, customer);
  if (subscription === null || TERMINAL.has(subscription.status)) {
    throw invalidRequest('There is no active subscription to change.');
  }
  return await requireSubscription(engine, subscription.id);
}

/**
 * Applies one portal action for the session's customer. Returns `declined`
 * when a charge the action made failed — the change itself still stands, as
 * it does at a real provider (a switch leaves the plan past due).
 */
export async function portalAct(
  engine: Engine,
  args: { readonly sessionId: string; readonly action: PortalAction }
): Promise<'ok' | 'declined'> {
  const session = await requirePortalSession(engine, args.sessionId);
  const customer = session.customer;
  await settleCustomer(engine, customer);
  const nowS = await customerNowS(engine, customer);
  const { action } = args;
  if (action.kind === 'update_payment_method') {
    await attachDefaultPaymentMethod(engine, customer, action.paymentMethod);
    const subscription = await focusSubscription(engine, customer);
    if (subscription === null || TERMINAL.has(subscription.status)) return 'ok';
    const paid = await payOpenInvoice(engine, subscription, nowS);
    return paid === 'declined' ? 'declined' : 'ok';
  }
  const subscription = await liveSubscription(engine, customer);
  if (action.kind === 'cancel' || action.kind === 'renew') {
    await setCancelAtPeriodEnd(engine, subscription, {
      cancel: action.kind === 'cancel',
      feedback: action.kind === 'cancel' ? action.reason : null,
      nowS,
    });
    return 'ok';
  }
  const price = (await switchablePrices(engine)).find(
    (p) => p.id === action.price
  );
  if (price === undefined) {
    throw invalidRequest(
      `The price '${action.price}' is not offered here.`,
      'price'
    );
  }
  const switched = await switchPrice(engine, subscription, { price, nowS });
  return switched.status === 'past_due' ? 'declined' : 'ok';
}
