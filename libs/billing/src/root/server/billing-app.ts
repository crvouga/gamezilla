import { Hono } from 'hono';
import {
  BillingCheckoutRoutes,
  type BillingRoutesDeps,
} from '../../use-cases/create-checkout-session/server/billing-checkout-route';

export class BillingApp {
  constructor(private readonly deps: BillingRoutesDeps) {}

  build(): Hono {
    return new Hono().route('/', new BillingCheckoutRoutes(this.deps).build());
  }
}
