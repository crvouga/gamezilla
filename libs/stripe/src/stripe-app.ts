import type { SqlClient } from '@pkgs/sql-client/interface';
import { Hono } from 'hono';
import type Stripe from 'stripe';
import {
  createStripeCheckoutRoutes,
  type StripeRequireAuth,
} from './stripe-checkout-route';

export function createStripeApp(args: {
  readonly getSqlClient: () => SqlClient;
  readonly stripe: Stripe | null;
  readonly requireAuth: StripeRequireAuth;
}) {
  const checkout = createStripeCheckoutRoutes({
    getSqlClient: args.getSqlClient,
    stripe: args.stripe,
    requireAuth: args.requireAuth,
  });

  return new Hono().route('/', checkout);
}
