import type { SecretStore } from '@pkgs/secret-store';
import type { PatchDb } from '@pkgs/patch-db/interface';
import { Hono } from 'hono';
import type Stripe from 'stripe';
import {
  createStripeCheckoutRoutes,
  type StripeRequireAuth,
} from './stripe-checkout-route';
import { createStripeWebhookRoutes } from './stripe-webhook-route';

/**
 * Stripe HTTP surface for the API Worker: webhook + checkout + portal.
 * Mount at `/` on a parent app that already defines Worker `Bindings`.
 */
export function createStripeApp(args: {
  readonly getPatchDb: () => PatchDb;
  readonly secretStore: SecretStore;
  readonly stripe: Stripe | null;
  readonly requireAuth: StripeRequireAuth;
  /** Doppler secret name for the webhook signing secret. */
  readonly webhookSecretDopplerKey: string;
}) {
  const webhook = createStripeWebhookRoutes({
    secretStore: args.secretStore,
    stripe: args.stripe,
    getPatchDb: args.getPatchDb,
    webhookSecretKey: args.webhookSecretDopplerKey,
  });
  const checkout = createStripeCheckoutRoutes({
    getPatchDb: args.getPatchDb,
    stripe: args.stripe,
    requireAuth: args.requireAuth,
  });

  return new Hono().route('/', webhook).route('/', checkout);
}
