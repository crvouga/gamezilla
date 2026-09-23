import { Hono } from 'hono';

import type { BillingRouteDeps } from '../../shared/routes/billing-route-deps';
import { BillingCallbackRoutes } from '../../use-cases/apply-subscription-state/server/billing-callback-route';
import { BillingCheckoutRoutes } from '../../use-cases/create-checkout-session/server/billing-checkout-route';
import { BillingPortalRoutes } from '../../use-cases/open-portal-session/server/billing-portal-route';

export type { BillingRouteDeps } from '../../shared/routes/billing-route-deps';

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
