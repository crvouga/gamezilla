/**
 * `/v1/subscriptions` and `/v1/invoices`: read, update, cancel, resume, pay.
 * Every call catches the customer up to their test clock first. Calls made
 * through the API are off-session — nobody is there to pass 3D Secure.
 */
import {
  MOCK_BILLING_PATHS,
  type MockInvoice,
  type MockSubscription,
  type MockSubscriptionStatus,
} from '@pkgs/billing-mock/wire';
import type { Hono } from 'hono';

import {
  type ProrationBehavior,
  settleCustomer,
  switchPrice,
} from '../engine/billing-cycle';
import { customerNowS, type Engine } from '../engine/context';
import { requireCustomer } from '../engine/customers';
import { requireInvoice } from '../engine/invoices';
import { requirePrice } from '../engine/prices';
import { refundInvoice } from '../engine/refunds';
import {
  endSubscription,
  payOpenInvoice,
  requireSubscription,
  resumeSubscription,
  setCancelAtPeriodEnd,
  TERMINAL,
} from '../engine/subscriptions';
import {
  authenticationRequired,
  cardDeclined,
  expiredCard,
  invalidRequest,
} from '../errors';
import { expandList, expandObject, expandOf } from './expand';
import { page } from './list';
import {
  answer,
  type Body,
  listField,
  optionalBoolean,
  optionalString,
  readBody,
  readQuery,
  recordField,
  stringField,
} from './request';
import type { ProviderRunner } from './runner';

async function settled(
  engine: Engine,
  subscriptionId: string
): Promise<MockSubscription> {
  const before = await requireSubscription(engine, subscriptionId);
  await settleCustomer(engine, before.customer);
  return await requireSubscription(engine, subscriptionId);
}

const PRORATION: readonly ProrationBehavior[] = [
  'create_prorations',
  'always_invoice',
  'none',
];

function prorationOf(body: Body): ProrationBehavior {
  const value = optionalString(body, 'proration_behavior');
  if (value === undefined) return 'create_prorations';
  if ((PRORATION as readonly string[]).includes(value)) {
    return value as ProrationBehavior;
  }
  throw invalidRequest(
    `Invalid proration_behavior: ${value}`,
    'proration_behavior'
  );
}

async function updateSubscription(
  engine: Engine,
  id: string,
  body: Body
): Promise<MockSubscription> {
  let subscription = await settled(engine, id);
  const nowS = await customerNowS(engine, subscription.customer);
  const item = listField(body, 'items')[0] as Body | undefined;
  if (item !== undefined) {
    const price = await requirePrice(engine, stringField(item, 'price'));
    subscription = await switchPrice(engine, subscription, {
      price,
      nowS,
      proration: prorationOf(body),
      session: 'off_session',
    });
  }
  const cancel = optionalBoolean(body, 'cancel_at_period_end');
  if (cancel !== undefined) {
    const details = recordField(body, 'cancellation_details');
    subscription = await setCancelAtPeriodEnd(engine, subscription, {
      cancel,
      feedback:
        details === undefined
          ? null
          : (optionalString(details, 'feedback') ?? null),
      nowS,
    });
  }
  return subscription;
}

/**
 * Stripe's `status` filter: unset lists every subscription that is not
 * canceled; `ended` is canceled or expired; `all` is everything.
 */
function statusFilter(
  status: string | undefined
): (subscription: MockSubscription) => boolean {
  if (status === 'all') return () => true;
  if (status === undefined) return (s) => s.status !== 'canceled';
  if (status === 'ended') return (s) => TERMINAL.has(s.status);
  return (s) => s.status === (status as MockSubscriptionStatus);
}

async function listSubscriptions(engine: Engine, query: Body) {
  const customer = stringField(query, 'customer');
  await requireCustomer(engine, customer);
  await settleCustomer(engine, customer);
  const all = await engine.db.list<MockSubscription>('subscription', customer);
  const keep = statusFilter(optionalString(query, 'status'));
  const fresh: MockSubscription[] = [];
  for (const subscription of all) {
    if (keep(subscription)) {
      fresh.push(await requireSubscription(engine, subscription.id));
    }
  }
  return await expandList(
    engine,
    page(MOCK_BILLING_PATHS.subscriptions, fresh, query),
    expandOf(query)
  );
}

async function listInvoices(engine: Engine, query: Body) {
  const customer = stringField(query, 'customer');
  await settleCustomer(engine, customer);
  const subscription = optionalString(query, 'subscription');
  const invoices = (
    await engine.db.list<MockInvoice>('invoice', customer)
  ).filter(
    (invoice) =>
      subscription === undefined || invoice.subscription === subscription
  );
  return page(MOCK_BILLING_PATHS.invoices, invoices, query);
}

function subscriptionReads(api: Hono, runner: ProviderRunner): void {
  api.get(MOCK_BILLING_PATHS.subscriptions, async (c) =>
    answer(c, () =>
      runner.run((engine) => listSubscriptions(engine, readQuery(c)))
    )
  );
  api.get('/v1/subscriptions/:id', async (c) =>
    answer(c, () =>
      runner.run(async (engine) =>
        expandObject(
          engine,
          await settled(engine, c.req.param('id')),
          expandOf(readQuery(c))
        )
      )
    )
  );
}

function subscriptionWrites(api: Hono, runner: ProviderRunner): void {
  api.post('/v1/subscriptions/:id', async (c) =>
    answer(c, async () => {
      const body = await readBody(c);
      return await runner.run(async (engine) =>
        expandObject(
          engine,
          await updateSubscription(engine, c.req.param('id'), body),
          expandOf(body)
        )
      );
    })
  );
  api.post('/v1/subscriptions/:id/resume', async (c) =>
    answer(c, () =>
      runner.run(async (engine) => {
        const subscription = await settled(engine, c.req.param('id'));
        return await resumeSubscription(engine, subscription, {
          nowS: await customerNowS(engine, subscription.customer),
          session: 'off_session',
        });
      })
    )
  );
  api.delete('/v1/subscriptions/:id', async (c) =>
    answer(c, () =>
      runner.run(async (engine) => {
        const subscription = await settled(engine, c.req.param('id'));
        if (TERMINAL.has(subscription.status)) {
          throw invalidRequest(
            `This subscription is already ${subscription.status}.`
          );
        }
        return await endSubscription(engine, subscription, {
          endedAtS: await customerNowS(engine, subscription.customer),
          reason: 'cancellation_requested',
        });
      })
    )
  );
}

function invoiceRoutes(api: Hono, runner: ProviderRunner): void {
  api.get(MOCK_BILLING_PATHS.invoices, async (c) =>
    answer(c, () => runner.run((engine) => listInvoices(engine, readQuery(c))))
  );
  api.get('/v1/invoices/:id', async (c) =>
    answer(c, () =>
      runner.run((engine) => requireInvoice(engine, c.req.param('id')))
    )
  );
  api.post('/v1/invoices/:id/pay', async (c) =>
    answer(c, async () => {
      const id = c.req.param('id');
      const outcome = await runner.run(async (engine) => {
        const invoice = await requireInvoice(engine, id);
        if (invoice.status !== 'open') {
          throw invalidRequest(`Invoice is already ${invoice.status}.`);
        }
        const subscription = await settled(engine, invoice.subscription);
        return await payOpenInvoice(engine, subscription, {
          nowS: await customerNowS(engine, invoice.customer),
          session: 'off_session',
        });
      });
      // The failed attempt is recorded before the failure is reported.
      if (outcome === 'authentication_required') throw authenticationRequired();
      if (outcome === 'expired_card') throw expiredCard();
      if (outcome === 'declined' || outcome === 'no_payment_method') {
        throw cardDeclined();
      }
      return await runner.run((engine) => requireInvoice(engine, id));
    })
  );
}

function refundRoutes(api: Hono, runner: ProviderRunner): void {
  api.post(MOCK_BILLING_PATHS.refunds, async (c) =>
    answer(c, async () => {
      const invoice = optionalString(await readBody(c), 'invoice');
      if (invoice === undefined) {
        throw invalidRequest('A refund names the paid invoice.', 'invoice');
      }
      return await runner.run((engine) => refundInvoice(engine, invoice));
    })
  );
}

export function billingRoutes(api: Hono, runner: ProviderRunner): void {
  subscriptionReads(api, runner);
  subscriptionWrites(api, runner);
  invoiceRoutes(api, runner);
  refundRoutes(api, runner);
}
