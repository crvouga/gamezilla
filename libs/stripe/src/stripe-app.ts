import type { SecretStore } from '@pkgs/secret-store';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { Hono } from 'hono';
import type Stripe from 'stripe';
import {
  createStripeCheckoutRoutes,
  type StripeRequireAuth,
} from './stripe-checkout-route';
import { createStripeWebhookRoutes } from './stripe-webhook-route';

export function createStripeApp(args: {
  readonly getSqlClient: () => SqlClient;
  readonly secretStore: SecretStore;
  readonly stripe: Stripe | null;
  readonly requireAuth: StripeRequireAuth;
  readonly webhookSecretKey: string;
}) {
  const webhook = createStripeWebhookRoutes({
    secretStore: args.secretStore,
    stripe: args.stripe,
    getSqlClient: args.getSqlClient,
    webhookSecretKey: args.webhookSecretKey,
  });
  const checkout = createStripeCheckoutRoutes({
    getSqlClient: args.getSqlClient,
    stripe: args.stripe,
    requireAuth: args.requireAuth,
  });

  return new Hono().route('/', webhook).route('/', checkout);
}
