/**
 * The hosted pages and the JSON API they call. A page is authorized by the
 * session id in its own URL; it can reach that one customer and nothing else.
 */
import {
  MOCK_TEST_PAYMENT_METHODS,
  type MockTestPaymentMethod,
} from '@pkgs/billing-mock/wire';
import { type Context, Hono } from 'hono';

import type { CheckoutConfirmResult, PortalAction } from '../../shared/pages';
import { settleCustomer } from '../engine/billing-cycle';
import { completeCheckout, readCheckoutSession } from '../engine/sessions';
import { checkoutView, portalAct, portalView } from '../engine/views';
import { cardDeclined, invalidRequest, resourceMissing } from '../errors';
import {
  answer,
  type Body,
  optionalString,
  readBody,
  stringField,
} from './request';
import type { ProviderRunner } from './runner';

const TEST_PAYMENT_METHODS: readonly string[] = Object.values(
  MOCK_TEST_PAYMENT_METHODS
);

function paymentMethodField(body: Body): MockTestPaymentMethod {
  const value = stringField(body, 'paymentMethod');
  if (!TEST_PAYMENT_METHODS.includes(value)) {
    throw invalidRequest(
      `Unknown test payment method ${value}.`,
      'paymentMethod'
    );
  }
  return value as MockTestPaymentMethod;
}

function portalActionOf(body: Body): PortalAction {
  const kind = stringField(body, 'kind');
  if (kind === 'cancel')
    return { kind, reason: optionalString(body, 'reason') ?? null };
  if (kind === 'renew') return { kind };
  if (kind === 'switch') return { kind, price: stringField(body, 'price') };
  if (kind === 'update_payment_method') {
    return { kind, paymentMethod: paymentMethodField(body) };
  }
  throw invalidRequest(`Unknown portal action ${kind}.`, 'kind');
}

export function pageApiRoutes(runner: ProviderRunner): Hono {
  return new Hono()
    .get('/pages/api/checkout/:id', async (c: Context) =>
      answer(c, () =>
        runner.run(async (engine) => {
          const session = await readCheckoutSession(
            engine,
            c.req.param('id') ?? ''
          );
          await settleCustomer(engine, session.customer);
          return await checkoutView(engine, session);
        })
      )
    )
    .post('/pages/api/checkout/:id/confirm', async (c: Context) =>
      answer(c, async (): Promise<CheckoutConfirmResult> => {
        const body = await readBody(c);
        const session = await runner.run((engine) =>
          completeCheckout(engine, {
            sessionId: c.req.param('id') ?? '',
            priceId: stringField(body, 'price'),
            paymentMethod: paymentMethodField(body),
          })
        );
        return { redirectUrl: session.success_url };
      })
    )
    .get('/pages/api/portal/:id', async (c: Context) =>
      answer(c, () =>
        runner.run((engine) => portalView(engine, c.req.param('id') ?? ''))
      )
    )
    .post('/pages/api/portal/:id/actions', async (c: Context) =>
      answer(c, async () => {
        const action = portalActionOf(await readBody(c));
        const sessionId = c.req.param('id') ?? '';
        const outcome = await runner.run((engine) =>
          portalAct(engine, { sessionId, action })
        );
        // The change stands; the page re-reads and shows the decline.
        if (outcome === 'declined') throw cardDeclined();
        return await runner.run((engine) => portalView(engine, sessionId));
      })
    )
    .all('/pages/api/*', (c: Context) => {
      const error = resourceMissing('page route', c.req.path);
      return c.json(error.toBody(), 404);
    });
}
