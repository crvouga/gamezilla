import { expect } from 'bun:test';
import { createHmac } from 'node:crypto';
import { apiNow } from '@apps/product/sim/acceptance/system';
import { SIM_STRIPE_WEBHOOK_SECRET } from '@apps/server/sim/sim-constants';

import {
  type Actor,
  type ApiRun,
  CALLBACK,
  call,
  headers,
  type Json,
  query,
  text,
} from './support';

/** Payment-failure access window. Anchored to the provider event time. */
export const GRACE_MS = 7 * 24 * 60 * 60 * 1000;

const SUCCESS_URL = `${CALLBACK.replace('/sso-callback', '')}/billing/success`;
const CANCEL_URL = `${CALLBACK.replace('/sso-callback', '')}/billing/cancel`;

export function stripeSignature(raw: string, timestampSec: number): string {
  const mac = createHmac('sha256', SIM_STRIPE_WEBHOOK_SECRET)
    .update(`${timestampSec}.${raw}`)
    .digest('hex');
  return `t=${timestampSec},v1=${mac}`;
}

export async function nowSec(s: ApiRun): Promise<number> {
  return Math.floor((await s.read(apiNow)) / 1000);
}

export async function checkout(
  s: ApiRun,
  actor: Actor,
  priceKey = 'subscription_monthly',
  urls: { successUrl?: string; cancelUrl?: string } = {}
) {
  return call(s, {
    path: '/billing/checkout',
    headers: headers(actor),
    body: {
      priceKey,
      successUrl: urls.successUrl ?? SUCCESS_URL,
      cancelUrl: urls.cancelUrl ?? CANCEL_URL,
    },
  });
}

export async function portal(s: ApiRun, actor: Actor, returnUrl = SUCCESS_URL) {
  return call(s, {
    path: '/billing/portal',
    headers: headers(actor),
    body: { returnUrl },
  });
}

export async function postWebhook(s: ApiRun, event: Json) {
  const raw = JSON.stringify(event);
  const signedAt = await nowSec(s);
  return call(s, {
    path: '/billing/webhook',
    headers: { 'stripe-signature': stripeSignature(raw, signedAt) },
    rawBody: raw,
  });
}

export async function subscription(
  s: ApiRun,
  actor: Actor
): Promise<Json | undefined> {
  const tables = await query(s, actor, 'billingSubscription');
  const rows = (tables['billing_subscriptions'] ?? []).filter(
    (row) => row['deleted_at'] === null
  );
  expect(rows.length).toBeLessThanOrEqual(1);
  return rows[0];
}

function instant(value: unknown): number {
  if (typeof value !== 'string' && !(value instanceof Date)) {
    throw new Error(`expected timestamp, got ${typeof value}`);
  }
  const parsed = Date.parse(String(value));
  if (!Number.isFinite(parsed))
    throw new Error(`bad timestamp ${String(value)}`);
  return parsed;
}

/** Access rule the synced row must implement. Boundary instants are closed. */
export function entitled(row: Json | undefined, nowMs: number): boolean {
  if (row === undefined) return false;
  const until = (key: string) => {
    const value = row[key];
    if (value === null || value === undefined) return false;
    return instant(value) > nowMs;
  };
  switch (row['status']) {
    case 'trialing':
      return until('trial_end');
    case 'active':
      return until('current_period_end');
    case 'past_due':
      return until('grace_until');
    case 'canceled':
      return until('current_period_end');
    default:
      return false;
  }
}

export async function access(s: ApiRun, actor: Actor): Promise<boolean> {
  return entitled(await subscription(s, actor), await s.read(apiNow));
}

export function checkoutCompleted(args: {
  id: string;
  accountId: string;
  customerId: string;
  priceKey: string;
  created: number;
}): Json {
  return {
    id: args.id,
    type: 'checkout.session.completed',
    created: args.created,
    data: {
      object: {
        id: `cs_${args.id}`,
        client_reference_id: args.accountId,
        customer: args.customerId,
        mode: 'subscription',
        payment_status: 'unpaid',
        metadata: { accountId: args.accountId, priceKey: args.priceKey },
      },
    },
  };
}

export function subscriptionUpdated(args: {
  id: string;
  accountId: string;
  customerId: string;
  status: string;
  created: number;
  trialEnd: number | null;
  periodEnd: number;
  cancelAtPeriodEnd?: boolean;
  priceKey: string;
}): Json {
  return {
    id: args.id,
    type: 'customer.subscription.updated',
    created: args.created,
    data: {
      object: {
        id: `sub_${args.accountId}`,
        customer: args.customerId,
        status: args.status,
        trial_end: args.trialEnd,
        current_period_end: args.periodEnd,
        cancel_at_period_end: args.cancelAtPeriodEnd === true,
        metadata: { accountId: args.accountId },
        items: { data: [{ price: { lookup_key: args.priceKey } }] },
      },
    },
  };
}

export function paymentFailed(args: {
  id: string;
  accountId: string;
  customerId: string;
  created: number;
}): Json {
  return {
    id: args.id,
    type: 'invoice.payment_failed',
    created: args.created,
    data: {
      object: {
        id: `in_${args.id}`,
        customer: args.customerId,
        subscription: `sub_${args.accountId}`,
        billing_reason: 'subscription_cycle',
        attempt_count: 1,
      },
    },
  };
}

export function paymentSucceeded(args: {
  id: string;
  accountId: string;
  customerId: string;
  created: number;
  periodEnd: number;
}): Json {
  return {
    id: args.id,
    type: 'invoice.payment_succeeded',
    created: args.created,
    data: {
      object: {
        id: `in_${args.id}`,
        customer: args.customerId,
        subscription: `sub_${args.accountId}`,
        billing_reason: 'subscription_cycle',
        period_end: args.periodEnd,
      },
    },
  };
}

/** Checkout must not grant access. A following verified subscription event does. */
export async function activate(
  s: ApiRun,
  actor: Actor,
  priceKey = 'subscription_monthly'
): Promise<{ customerId: string; created: number; periodEnd: number }> {
  const started = await checkout(s, actor, priceKey);
  expect(started.status).toBe(200);
  const body = started.body as Json;
  expect(String(body['url']).startsWith('https://')).toBe(true);
  const customerId = text(body['customerId'], 'customer id');
  expect(await access(s, actor)).toBe(false);
  const created = await nowSec(s);
  const periodEnd = created + 30 * 24 * 60 * 60;
  expect(
    (
      await postWebhook(
        s,
        checkoutCompleted({
          id: `evt_cs_${actor.accountId}`,
          accountId: actor.accountId,
          customerId,
          priceKey,
          created,
        })
      )
    ).status
  ).toBe(200);
  expect(await access(s, actor)).toBe(false);
  expect(
    (
      await postWebhook(
        s,
        subscriptionUpdated({
          id: `evt_sub_${actor.accountId}`,
          accountId: actor.accountId,
          customerId,
          status: 'active',
          created,
          trialEnd: null,
          periodEnd,
          priceKey,
        })
      )
    ).status
  ).toBe(200);
  const row = await subscription(s, actor);
  expect(row?.['status']).toBe('active');
  expect(row?.['price_key']).toBe(priceKey);
  expect(row?.['customer_id']).toBe(customerId);
  expect(await access(s, actor)).toBe(true);
  return { customerId, created, periodEnd };
}
