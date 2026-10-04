import type { BillingRouteDeps } from '@libs/billing-shared/billing-route-deps';
import { Hono } from 'hono';
import { BillingCallbackRoutes } from './billing-callback-route';
import { BillingCheckoutRoutes } from './billing-checkout-route';
import { BillingPortalRoutes } from './billing-portal-route';

/**
 * Checkout, portal and callback — the same three routes whichever provider
 * the host configured. Nothing here knows which one it is.
 */
export class BillingApp {
  constructor(private readonly deps: BillingRouteDeps) {}

  build(): Hono {
    return new Hono()
      .route('/', new BillingCheckoutRoutes(this.deps).build())
      .route('/', new BillingPortalRoutes(this.deps).build())
      .route('/', new BillingCallbackRoutes(this.deps).build());
  }
}
