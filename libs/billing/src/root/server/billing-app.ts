import { Hono } from 'hono';

import type { BillingRouteDeps } from '../../shared/routes/billing-route-deps';
import { BillingCallbackRoutes } from '../../use-cases/apply-subscription-state/server/billing-callback-route';
import { BillingCheckoutRoutes } from '../../use-cases/create-checkout-session/server/billing-checkout-route';
import type { BillingMockDeps } from '../../use-cases/mock-provider/server/billing-mock-routes';
import { BillingMockRoutes } from '../../use-cases/mock-provider/server/billing-mock-routes';
import { BillingPortalRoutes } from '../../use-cases/open-portal-session/server/billing-portal-route';

export type { BillingRouteDeps } from '../../shared/routes/billing-route-deps';
export type { BillingMockDeps } from '../../use-cases/mock-provider/server/billing-mock-routes';

export type BillingAppDeps = BillingRouteDeps & {
  readonly mock: BillingMockDeps | null;
};

export class BillingApp {
  constructor(private readonly deps: BillingAppDeps) {}

  build(): Hono {
    const app = new Hono()
      .route('/', new BillingCheckoutRoutes(this.deps).build())
      .route('/', new BillingPortalRoutes(this.deps).build())
      .route('/', new BillingCallbackRoutes(this.deps).build());
    if (this.deps.mock !== null) {
      app.route('/', new BillingMockRoutes(this.deps.mock).build());
    }
    return app;
  }
}
