import Stripe from 'stripe';

/** Stripe client for Cloudflare Workers (fetch transport). */
export function makeStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}
