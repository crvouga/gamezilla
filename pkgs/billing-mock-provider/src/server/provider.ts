/**
 * The mock payment provider: its own origin, its own state, its own clock
 * per customer. The app reaches it only the way it reaches Stripe — the
 * adapter's REST calls, the person's browser on the hosted pages, and signed
 * webhooks back to the app.
 */
import type { MockBillingCatalog } from '@pkgs/billing-mock/catalog';
import type { Clock, Timers } from '@pkgs/clock';
import type { Logger } from '@pkgs/logger';
import { createNoopLogger } from '@pkgs/logger';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid/create-id';
import { Hono } from 'hono';

import {
  type ProviderFetch,
  WebhookDelivery,
  type WebhookEndpoint,
} from './delivery';
import type { Engine } from './engine/context';
import { seedCatalog } from './engine/prices';
import { apiRoutes } from './routes/api';
import { assetRoutes } from './routes/assets';
import { pageApiRoutes } from './routes/pages';
import type { ProviderRunner } from './routes/runner';
import { ProviderStore } from './store';

export type MockBillingProviderOptions = {
  readonly sqlClient: SqlClient;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: CreateId;
  /** Outbound HTTP, for webhooks. */
  readonly fetch: ProviderFetch;
  /** Where the provider is served; hosted-page links are built from it. */
  readonly origin: string;
  readonly catalog: MockBillingCatalog;
  /** The key `/v1/*` requires (`sk_test_mock_…`). */
  readonly secretKey: string;
  /** Where events go; `null` sends none. */
  readonly webhook: WebhookEndpoint | null;
  readonly logger?: Logger;
};

export type MockBillingProvider = {
  readonly app: Hono;
  readonly origin: string;
  /** Attempt every webhook delivery that is due right now. */
  flushWebhooks(): Promise<void>;
};

export async function createMockBillingProvider(
  options: MockBillingProviderOptions
): Promise<MockBillingProvider> {
  const logger = options.logger ?? createNoopLogger();
  const store = await ProviderStore.open({
    sqlClient: options.sqlClient,
    logger,
  });
  await store.tx((db) =>
    seedCatalog(db, options.catalog, Math.floor(options.clock.now() / 1000))
  );
  const delivery = new WebhookDelivery({
    store,
    endpoint: options.webhook,
    fetch: options.fetch,
    clock: options.clock,
    timers: options.timers,
    logger,
  });
  const deps = {
    clock: options.clock,
    createId: options.createId,
    catalog: options.catalog,
    origin: options.origin,
  };
  const runner: ProviderRunner = {
    async run<T>(fn: (engine: Engine) => Promise<T>): Promise<T> {
      const result = await store.tx((db) => fn({ db, deps }));
      delivery.kick();
      return result;
    },
  };
  const app = new Hono()
    .get('/health', (c) => c.json({ ok: true }))
    .route('/', apiRoutes({ runner, secretKey: options.secretKey }))
    .route('/', pageApiRoutes(runner))
    .route('/', assetRoutes());
  // Anything a failed boot left undelivered goes out now.
  delivery.kick();
  return {
    app,
    origin: options.origin,
    flushWebhooks: () => delivery.flush(),
  };
}
