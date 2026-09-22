/**
 * Hosted sessions: a checkout session (24 h to pay, once) and a portal
 * session (an hour to manage one customer). The session id in the link is
 * the only credential a hosted page has.
 */
import type {
  CreateCheckoutSessionBody,
  CreatePortalSessionBody,
  MockCheckoutSession,
  MockPortalSession,
  MockPrice,
} from '@pkgs/billing-mock/wire';
import { MOCK_BILLING_PATHS } from '@pkgs/billing-mock/wire';

import {
  invalidRequest,
  paymentMethodRequired,
  resourceMissing,
  sessionExpired,
} from '../errors';
import { customerNowS, DAY_S, type Engine, emit, mint } from './context';
import { attachDefaultPaymentMethod, requireCustomer } from './customers';
import { requirePrice, switchablePrices } from './prices';
import { DEFAULT_TRIAL_SETTINGS, startSubscription } from './subscriptions';

const CHECKOUT_TTL_S = DAY_S;
const PORTAL_TTL_S = 60 * 60;

function checkoutPrice(session: MockCheckoutSession): MockPrice {
  const line = session.line_items.data[0];
  if (line === undefined)
    throw new Error('mock billing: session has no line item');
  return line.price;
}

export async function createCheckoutSession(
  engine: Engine,
  body: CreateCheckoutSessionBody
): Promise<MockCheckoutSession> {
  if (body.mode !== 'subscription') {
    throw invalidRequest('Only `subscription` mode is supported.', 'mode');
  }
  await requireCustomer(engine, body.customer);
  const line = body.line_items[0];
  if (line.quantity !== 1) {
    throw invalidRequest('Quantity must be 1.', 'line_items[0][quantity]');
  }
  const price = await requirePrice(engine, line.price);
  const nowS = await customerNowS(engine, body.customer);
  const trialDays = body.subscription_data?.trial_period_days ?? null;
  const id = mint(engine, 'cs_test');
  const session: MockCheckoutSession = {
    id,
    object: 'checkout.session',
    mode: 'subscription',
    status: 'open',
    payment_status: 'unpaid',
    payment_method_collection: body.payment_method_collection ?? 'always',
    amount_total: trialDays === null ? price.unit_amount : 0,
    currency: price.currency,
    url: `${engine.deps.origin}${MOCK_BILLING_PATHS.checkoutPage(id)}`,
    customer: body.customer,
    client_reference_id: body.client_reference_id ?? null,
    success_url: body.success_url,
    cancel_url: body.cancel_url,
    line_items: {
      object: 'list',
      has_more: false,
      url: `/v1/checkout/sessions/${id}/line_items`,
      data: [{ price, quantity: 1 }],
    },
    subscription_data: {
      metadata: body.subscription_data?.metadata ?? {},
      trial_period_days: trialDays,
      trial_settings:
        body.subscription_data?.trial_settings ?? DEFAULT_TRIAL_SETTINGS,
    },
    subscription: null,
    expires_at: nowS + CHECKOUT_TTL_S,
    created: nowS,
    livemode: false,
  };
  await engine.db.put(session, body.customer);
  return session;
}

/** Expires an open session at `atS` and says so (`checkout.session.expired`). */
export async function expireCheckoutSession(
  engine: Engine,
  session: MockCheckoutSession,
  atS: number
): Promise<MockCheckoutSession> {
  if (session.status !== 'open') {
    throw invalidRequest(
      `Only open checkout sessions can be expired; this one is ${session.status}.`
    );
  }
  const expired: MockCheckoutSession = {
    ...session,
    status: 'expired',
    url: null,
  };
  await engine.db.put(expired, session.customer);
  await emit(engine, {
    type: 'checkout.session.expired',
    object: expired,
    createdS: atS,
  });
  return expired;
}

/** The session as it stands now: an unpaid session past its expiry expires. */
export async function readCheckoutSession(
  engine: Engine,
  id: string
): Promise<MockCheckoutSession> {
  const stored = await engine.db.get<MockCheckoutSession>(
    id,
    'checkout.session'
  );
  if (stored === null) throw resourceMissing('checkout session', id);
  const session = withSessionDefaults(stored);
  const nowS = await customerNowS(engine, session.customer);
  if (session.status !== 'open' || nowS < session.expires_at) return session;
  return await expireCheckoutSession(engine, session, session.expires_at);
}

/** Sessions stored before these fields existed carry Stripe's defaults. */
function withSessionDefaults(
  session: MockCheckoutSession
): MockCheckoutSession {
  return {
    ...session,
    payment_status:
      session.payment_status ??
      (session.status === 'complete' ? 'paid' : 'unpaid'),
    payment_method_collection: session.payment_method_collection ?? 'always',
    amount_total: session.amount_total ?? 0,
    currency: session.currency ?? checkoutPrice(session).currency,
    subscription_data: {
      ...session.subscription_data,
      trial_settings:
        session.subscription_data.trial_settings ?? DEFAULT_TRIAL_SETTINGS,
    },
    livemode: false,
  };
}

/** Whether the session may start without a card: a trial that asks for none. */
export function cardOptional(session: MockCheckoutSession): boolean {
  return (
    session.payment_method_collection === 'if_required' &&
    (session.subscription_data.trial_period_days ?? 0) > 0
  );
}

/** The prices a session may be paid at: its own, then the portal's others. */
export async function checkoutPrices(
  engine: Engine,
  session: MockCheckoutSession
): Promise<readonly MockPrice[]> {
  const own = checkoutPrice(session);
  const others = (await switchablePrices(engine)).filter(
    (price) => price.id !== own.id && price.product === own.product
  );
  return [own, ...others];
}

/**
 * Pays a checkout session: attach the card, start the subscription, mark the
 * session complete. Idempotent once complete; a declined card leaves the
 * session open for another try.
 */
export async function completeCheckout(
  engine: Engine,
  args: {
    readonly sessionId: string;
    readonly priceId: string;
    /** `null` only when the session collects a card `if_required`. */
    readonly paymentMethod: string | null;
  }
): Promise<MockCheckoutSession> {
  const session = await readCheckoutSession(engine, args.sessionId);
  if (session.status === 'complete') return session;
  if (session.status === 'expired') {
    throw sessionExpired('This checkout session has expired.');
  }
  const price = (await checkoutPrices(engine, session)).find(
    (candidate) => candidate.id === args.priceId
  );
  if (price === undefined) {
    throw invalidRequest(
      `The price '${args.priceId}' is not offered here.`,
      'price'
    );
  }
  if (args.paymentMethod === null && !cardOptional(session)) {
    throw paymentMethodRequired();
  }
  const method =
    args.paymentMethod === null
      ? null
      : await attachDefaultPaymentMethod(
          engine,
          session.customer,
          args.paymentMethod
        );
  const nowS = await customerNowS(engine, session.customer);
  const trialDays = session.subscription_data.trial_period_days ?? 0;
  const subscription = await startSubscription(engine, {
    customer: session.customer,
    price,
    nowS,
    trialDays,
    trialSettings: session.subscription_data.trial_settings,
    metadata: session.subscription_data.metadata,
    paymentMethod: method?.id ?? null,
  });
  const complete: MockCheckoutSession = {
    ...session,
    status: 'complete',
    payment_status: trialDays > 0 ? 'no_payment_required' : 'paid',
    amount_total: trialDays > 0 ? 0 : price.unit_amount,
    currency: price.currency,
    url: null,
    subscription: subscription.id,
  };
  await engine.db.put(complete, session.customer);
  await emit(engine, {
    type: 'checkout.session.completed',
    object: complete,
    createdS: nowS,
  });
  return complete;
}

export async function createPortalSession(
  engine: Engine,
  body: CreatePortalSessionBody
): Promise<MockPortalSession> {
  await requireCustomer(engine, body.customer);
  const nowS = await customerNowS(engine, body.customer);
  const id = mint(engine, 'bps');
  const session: MockPortalSession = {
    id,
    object: 'billing_portal.session',
    customer: body.customer,
    return_url: body.return_url,
    url: `${engine.deps.origin}${MOCK_BILLING_PATHS.portalPage(id)}`,
    created: nowS,
    expires_at: nowS + PORTAL_TTL_S,
  };
  await engine.db.put(session, body.customer);
  return session;
}

/** A live portal session, or a 410 once it has expired. */
export async function requirePortalSession(
  engine: Engine,
  id: string
): Promise<MockPortalSession> {
  const session = await engine.db.get<MockPortalSession>(
    id,
    'billing_portal.session'
  );
  if (session === null) throw resourceMissing('portal session', id);
  // Like every session time, expiry is on the customer's test clock.
  if ((await customerNowS(engine, session.customer)) >= session.expires_at) {
    throw sessionExpired(
      'This billing session has expired. Return to the app and open billing again.'
    );
  }
  return session;
}
