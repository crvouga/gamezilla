import type { SqlClient } from '@pkgs/sql-client/interface';
import { Hono } from 'hono';
import type Stripe from 'stripe';
import {
  StripeCheckoutRoutes,
  type StripeRequireAuth,
} from '../../use-cases/create-checkout-session/server/stripe-checkout-route';

export class StripeApp {
  constructor(
    private readonly getSqlClient: () => SqlClient,
    private readonly stripe: Stripe | null,
    private readonly requireAuth: StripeRequireAuth
  ) {}

  build(): Hono {
    const checkout = new StripeCheckoutRoutes(
      this.getSqlClient,
      this.stripe,
      this.requireAuth
    ).build();

    return new Hono().route('/', checkout);
  }
}
