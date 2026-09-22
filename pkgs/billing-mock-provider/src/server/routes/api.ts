/**
 * The provider's REST API (`/v1/*`), for the adapter and for tests. Every
 * call needs the secret key; every call touching a customer first catches
 * that customer up to their test clock. Requests may be JSON or Stripe's form
 * encoding; POSTs honour `Idempotency-Key`; reads honour `expand[]`; lists
 * paginate with Stripe's cursors.
 */
import { MOCK_BILLING_PATHS, type MockPrice } from '@pkgs/billing-mock/wire';
import { type Context, Hono } from 'hono';

import { settleCustomer } from '../engine/billing-cycle';
import { customerNowS, type Engine } from '../engine/context';
import {
  attachDefaultPaymentMethod,
  createCustomer,
  requireCustomer,
} from '../engine/customers';
import { pricesByLookupKeys, requirePrice } from '../engine/prices';
import {
  createCheckoutSession,
  createPortalSession,
  expireCheckoutSession,
  readCheckoutSession,
} from '../engine/sessions';
import { authenticationFailed, unrecognizedUrl } from '../errors';
import { billingRoutes } from './api-billing';
import { checkoutSessionBody } from './api-checkout-body';
import { apiTestHelperRoutes } from './api-test-helpers';
import { expandObject, expandOf } from './expand';
import { idempotency } from './idempotency';
import { page } from './list';
import {
  answer,
  type Body,
  optionalBoolean,
  optionalString,
  readBody,
  readQuery,
  recordField,
  stringField,
  stringList,
  stringRecord,
} from './request';
import type { ProviderRunner } from './runner';

function customerRoutes(api: Hono, runner: ProviderRunner): void {
  api.post(MOCK_BILLING_PATHS.customers, async (c) =>
    answer(c, async () => {
      const body = await readBody(c);
      const email = optionalString(body, 'email');
      const name = optionalString(body, 'name');
      return await runner.run((engine) =>
        createCustomer(engine, {
          ...(email === undefined ? {} : { email }),
          ...(name === undefined ? {} : { name }),
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
        await settleCustomer(engine, id);
        if (method !== undefined)
          await attachDefaultPaymentMethod(engine, id, method);
        return await requireCustomer(engine, id);
      });
    })
  );
}

/** `lookup_keys` repeated, bracketed or comma-separated, as clients send it. */
function lookupKeysOf(c: Context): readonly string[] {
  const repeated = (c.req.queries('lookup_keys') ?? []).flatMap((value) =>
    value.split(',')
  );
  return [...repeated, ...stringList(readQuery(c), 'lookup_keys')].filter(
    (key, index, all) => key.length > 0 && all.indexOf(key) === index
  );
}

async function listPrices(
  engine: Engine,
  query: Body,
  keys: readonly string[]
) {
  const active = optionalBoolean(query, 'active');
  const prices = (
    keys.length === 0
      ? await engine.db.all<MockPrice>('price')
      : await pricesByLookupKeys(engine, keys)
  ).filter((price) => active === undefined || price.active === active);
  return page(MOCK_BILLING_PATHS.prices, [...prices].reverse(), query);
}

function catalogRoutes(api: Hono, runner: ProviderRunner): void {
  api.get(MOCK_BILLING_PATHS.prices, async (c) =>
    answer(c, () =>
      runner.run((engine) => listPrices(engine, readQuery(c), lookupKeysOf(c)))
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
      return await runner.run(async (engine) =>
        expandObject(
          engine,
          await createCheckoutSession(engine, checkoutSessionBody(body)),
          expandOf(body)
        )
      );
    })
  );
  api.get('/v1/checkout/sessions/:id', async (c) =>
    answer(c, () =>
      runner.run(async (engine) =>
        expandObject(
          engine,
          await readCheckoutSession(engine, c.req.param('id')),
          expandOf(readQuery(c))
        )
      )
    )
  );
  api.post('/v1/checkout/sessions/:id/expire', async (c) =>
    answer(c, () =>
      runner.run(async (engine) => {
        const session = await readCheckoutSession(engine, c.req.param('id'));
        const nowS = await customerNowS(engine, session.customer);
        return await expireCheckoutSession(engine, session, nowS);
      })
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
  api.use('/v1/*', idempotency(args.runner));
  customerRoutes(api, args.runner);
  catalogRoutes(api, args.runner);
  sessionRoutes(api, args.runner);
  billingRoutes(api, args.runner);
  api.route('/', apiTestHelperRoutes(args.runner));
  api.all('/v1/*', (c: Context) =>
    c.json(unrecognizedUrl(c.req.method, c.req.path).toBody(), 404)
  );
  return api;
}
