import type { Billing } from '@pkgs/billing';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { Hono } from 'hono';
import {
  BillingCheckoutRoutes,
  type BillingRequireAuth,
} from '../../use-cases/create-checkout-session/server/billing-checkout-route';

export class BillingApp {
  constructor(
    private readonly getSqlClient: () => SqlClient,
    private readonly billing: Billing | null,
    private readonly requireAuth: BillingRequireAuth,
    private readonly now: () => number
  ) {}

  build(): Hono {
    const checkout = new BillingCheckoutRoutes(
      this.getSqlClient,
      this.billing,
      this.requireAuth,
      this.now
    ).build();

    return new Hono().route('/', checkout);
  }
}
