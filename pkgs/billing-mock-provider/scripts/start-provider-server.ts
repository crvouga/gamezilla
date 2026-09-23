// @io-wall-ok — loopback process adapter for the mock billing provider.

/**
 * Bind the provider to a loopback port on the wall clock. Port `0` asks the
 * OS for a free one, so several stacks run side by side.
 *
 * Durability is a property of the SQLite database opened here: in memory by
 * default, or an explicit file the caller resolved.
 */
import type { MockBillingCatalog } from '@pkgs/billing-mock/catalog';
import { wallClock, wallTimers } from '@pkgs/clock';
import { createGlobalHttpClient } from '@pkgs/http-client';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite/impl-bun-sqlite';

import {
  createMockBillingProvider,
  type MockBillingProvider,
  type WebhookEndpoint,
} from '../src/server/index';

export type ProviderStateLocation =
  | { readonly kind: 'memory' }
  | { readonly kind: 'file'; readonly path: string };

export type StartProviderServerOptions = {
  /** `0` (default) takes an OS-assigned port. */
  readonly port?: number;
  readonly hostname?: string;
  readonly catalog: MockBillingCatalog;
  readonly secretKey: string;
  readonly webhook: WebhookEndpoint | null;
  /** Default `{ kind: 'memory' }`. */
  readonly state?: ProviderStateLocation;
};

export type ProviderServerHandle = {
  readonly origin: string;
  readonly port: number;
  readonly provider: MockBillingProvider;
  stop(): Promise<void>;
};

export async function startMockBillingProviderServer(
  options: StartProviderServerOptions
): Promise<ProviderServerHandle> {
  const location = options.state ?? { kind: 'memory' };
  const sqlClient =
    location.kind === 'memory'
      ? SqlClientImplBunSqlite.openMemory()
      : SqlClientImplBunSqlite.open(location.path);
  await sqlClient.connect();
  const http = createGlobalHttpClient();
  // The origin is only known once bound; the provider is built on first use.
  let provider: MockBillingProvider | null = null;
  const server = Bun.serve({
    port: options.port ?? 0,
    hostname: options.hostname ?? '127.0.0.1',
    fetch: async (request) => {
      if (provider === null) return new Response('booting', { status: 503 });
      return await provider.app.fetch(request);
    },
  });
  provider = await createMockBillingProvider({
    sqlClient,
    clock: wallClock,
    timers: wallTimers,
    createId: () => crypto.randomUUID(),
    fetch: (input, init) => http.fetch(input, init),
    origin: server.url.origin,
    catalog: options.catalog,
    secretKey: options.secretKey,
    webhook: options.webhook,
  });
  return {
    origin: server.url.origin,
    port: Number(server.url.port),
    provider,
    async stop() {
      await server.stop(true);
      await sqlClient.disconnect();
    },
  };
}
