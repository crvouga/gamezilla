/**
 * The provider's REST API (`/v1/*`), for the adapter and for tests. Every
 * call needs the secret key; every call touching a customer first catches
 * that customer up to their test clock.
 */
import {
  MOCK_BILLING_PATHS,
  type MockInvoice,
  type MockList,
  type MockSubscription,
} from '@pkgs/billing-mock/wire';
import { type Context, Hono } from 'hono';

import { settleCustomer, switchPrice } from '../engine/billing-cycle';
import { customerNowS, type Engine } from '../engine/context';
import {
  attachDefaultPaymentMethod,
  createCustomer,
  requireCustomer,
} from '../engine/customers';
import { requireInvoice } from '../engine/invoices';
import { pricesByLookupKeys, requirePrice } from '../engine/prices';
import {
  createCheckoutSession,
  createPortalSession,
  readCheckoutSession,
} from '../engine/sessions';
import {
  endSubscription,
  payOpenInvoice,
  requireSubscription,
  setCancelAtPeriodEnd,
} from '../engine/subscriptions';
import { authenticationFailed, cardDeclined, invalidRequest } from '../errors';
import { apiTestHelperRoutes } from './api-test-helpers';
import {
  answer,
  optionalString,
  readBody,
  recordField,
  stringField,
  stringRecord,
} from './request';
import type { ProviderRunner } from './runner';

export function list<T>(url: string, data: readonly T[]): MockList<T> {
  return { object: 'list', data, has_more: false, url };
}

async function settled(engine: Engine, subscriptionId: string) {
  const before = await requireSubscription(engine, subscriptionId);
  await settleCustomer(engine, before.customer);
  return await requireSubscription(engine, subscriptionId);
}

function customerRoutes(api: Hono, runner: ProviderRunner): void {
  api.post(MOCK_BILLING_PATHS.customers, async (c) =>
    answer(c, async () => {
      const body = await readBody(c);
      return await runner.run((engine) =>
        createCustomer(engine, {
          ...(optionalString(body, 'email') === undefined
            ? {}
            : { email: stringField(body, 'email') }),
          ...(optionalString(body, 'name') === undefined
            ? {}
            : { name: stringField(body, 'name') }),
          metadata: stringRecord(recordField(body, 'metadata')),
        })
      );
    })
  );
  api.get('/v1/customers/:id', async (c) =>
    answer(c, () =>
      runner.run((engine) => requireCustomer(engine, c.req.param('id')))
    )
  );
  api.post('/v1/customers/:id', async (c) =>
    answer(c, async () => {
      const settings = recordField(await readBody(c), 'invoice_settings');
      const method =
        settings === undefined
          ? undefined
          : optionalString(settings, 'default_payment_method');
      const id = c.req.param('id');
      return await runner.run(async (engine) => {
        if (method !== undefined)
          await attachDefaultPaymentMethod(engine, id, method);
        return await requireCustomer(engine, id);
      });
    })
  );
}

/** `lookup_keys` repeated or comma-separated, as either client sends it. */
function lookupKeysOf(c: Context): readonly string[] | undefined {
  const raw = c.req.queries('lookup_keys') ?? [];
  const keys = raw.flatMap((value) => value.split(',')).filter(Boolean);
  return keys.length === 0 ? undefined : keys;
}

function catalogRoutes(api: Hono, runner: ProviderRunner): void {
  api.get(MOCK_BILLING_PATHS.prices, async (c) =>
    answer(c, () =>
      runner.run(async (engine) => {
        const keys = lookupKeysOf(c);
        if (keys === undefined || keys.length === 0) {
          throw invalidRequest(
            'Pass lookup_keys to list prices.',
            'lookup_keys'
          );
        }
        return list(
          MOCK_BILLING_PATHS.prices,
          await pricesByLookupKeys(engine, keys)
        );
      })
    )
  );
  api.get('/v1/prices/:id', async (c) =>
    answer(c, () =>
      runner.run((engine) => requirePrice(engine, c.req.param('id')))
    )
  );
}

function sessionRoutes(api: Hono, runner: ProviderRunner): void {
  api.post(MOCK_BILLING_PATHS.checkoutSessions, async (c) =>
    answer(c, async () => {
      const body = await readBody(c);
      const items = body['line_items'];
      const line = Array.isArray(items) ? (items[0] as unknown) : undefined;
      const price =
        line !== null && typeof line === 'object'
          ? stringField(line as Record<string, unknown>, 'price')
          : stringField({}, 'line_items[0][price]');
      if (body['mode'] !== 'subscription') {
        throw invalidRequest('Only `subscription` mode is supported.', 'mode');
      }
      const data = recordField(body, 'subscription_data');
      const trial = data?.['trial_period_days'];
      return await runner.run((engine) =>
        createCheckoutSession(engine, {
          mode: 'subscription',
          customer: stringField(body, 'customer'),
          ...(optionalString(body, 'client_reference_id') === undefined
            ? {}
            : {
                client_reference_id: stringField(body, 'client_reference_id'),
              }),
          line_items: [{ price, quantity: 1 }],
          success_url: stringField(body, 'success_url'),
          cancel_url: stringField(body, 'cancel_url'),
          subscription_data: {
            metadata: stringRecord(
              data === undefined ? undefined : recordField(data, 'metadata')
            ),
            ...(typeof trial === 'number' && trial > 0
              ? { trial_period_days: trial }
              : {}),
          },
        })
      );
    })
  );
  api.get('/v1/checkout/sessions/:id', async (c) =>
    answer(c, () =>
      runner.run((engine) => readCheckoutSession(engine, c.req.param('id')))
    )
  );
  api.post(MOCK_BILLING_PATHS.portalSessions, async (c) =>
    answer(c, async () => {
      const body = await readBody(c);
      return await runner.run((engine) =>
        createPortalSession(engine, {
          customer: stringField(body, 'customer'),
          return_url: stringField(body, 'return_url'),
        })
      );
    })
  );
}

async function updateSubscription(
  engine: Engine,
  id: string,
  body: Readonly<Record<string, unknown>>
): Promise<MockSubscription> {
  let subscription = await settled(engine, id);
  const nowS = await customerNowS(engine, subscription.customer);
  const items = body['items'];
  const item = Array.isArray(items)
    ? (items[0] as Record<string, unknown> | undefined)
    : undefined;
  if (item !== undefined) {
    const price = await requirePrice(engine, stringField(item, 'price'));
    subscription = await switchPrice(engine, subscription, { price, nowS });
  }
  const cancel = body['cancel_at_period_end'];
  if (
    typeof cancel === 'boolean' &&
    cancel !== subscription.cancel_at_period_end
  ) {
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

function subscriptionRoutes(api: Hono, runner: ProviderRunner): void {
  api.get(MOCK_BILLING_PATHS.subscriptions, async (c) =>
    answer(c, () =>
      runner.run(async (engine) => {
        const customer = c.req.query('customer');
        if (customer === undefined)
          throw invalidRequest('Pass customer.', 'customer');
        await requireCustomer(engine, customer);
        await settleCustomer(engine, customer);
        return list(
          MOCK_BILLING_PATHS.subscriptions,
          await engine.db.list<MockSubscription>('subscription', customer)
        );
      })
    )
  );
  api.get('/v1/subscriptions/:id', async (c) =>
    answer(c, () => runner.run((engine) => settled(engine, c.req.param('id'))))
  );
  api.post('/v1/subscriptions/:id', async (c) =>
    answer(c, async () => {
      const body = await readBody(c);
      return await runner.run((engine) =>
        updateSubscription(engine, c.req.param('id'), body)
      );
    })
  );
  api.delete('/v1/subscriptions/:id', async (c) =>
    answer(c, () =>
      runner.run(async (engine) => {
        const subscription = await settled(engine, c.req.param('id'));
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
    answer(c, () =>
      runner.run(async (engine) => {
        const customer = c.req.query('customer');
        if (customer === undefined)
          throw invalidRequest('Pass customer.', 'customer');
        await settleCustomer(engine, customer);
        return list(
          MOCK_BILLING_PATHS.invoices,
          await engine.db.list<MockInvoice>('invoice', customer)
        );
      })
    )
  );
  api.post('/v1/invoices/:id/pay', async (c) =>
    answer(c, async () => {
      const id = c.req.param('id');
      const outcome = await runner.run(async (engine) => {
        const invoice = await requireInvoice(engine, id);
        const subscription = await settled(engine, invoice.subscription);
        return await payOpenInvoice(
          engine,
          subscription,
          await customerNowS(engine, invoice.customer)
        );
      });
      // The failed attempt is recorded before the decline is reported.
      if (outcome === 'declined') throw cardDeclined();
      return await runner.run((engine) => requireInvoice(engine, id));
    })
  );
}

/** The whole `/v1` surface behind the secret key. */
export function apiRoutes(args: {
  readonly runner: ProviderRunner;
  readonly secretKey: string;
}): Hono {
  const api = new Hono();
  api.use('/v1/*', async (c: Context, next) => {
    if (c.req.header('authorization') !== `Bearer ${args.secretKey}`) {
      const error = authenticationFailed();
      return c.json(error.toBody(), 401);
    }
    await next();
    return undefined;
  });
  customerRoutes(api, args.runner);
  catalogRoutes(api, args.runner);
  sessionRoutes(api, args.runner);
  subscriptionRoutes(api, args.runner);
  invoiceRoutes(api, args.runner);
  api.route('/', apiTestHelperRoutes(args.runner));
  return api;
}
