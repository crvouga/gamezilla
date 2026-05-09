import { assert } from '@gamezilla/lib/assert';
import type { SecretStore } from '@gamezilla/lib/secret-store';
import type { MiddlewareHandler } from 'hono';
import { betterAuthAccountProvisioning } from '../auth/better-auth/account-provisioning';
import { createBetterAuthRequestStack } from '../auth/better-auth/create-better-auth';
import { SessionClaimsBetterAuthAdapter } from '../auth/better-auth/session-claims-port';
import { createSessionAuth } from '../auth/session-middleware';
import { ConfigurationError } from '../config/env';
import { createRequestPatchDb } from '../patch-db/patch-db';
import { openRequestDb } from '../patch-db/sql-client';
import { apiRequestAsyncLocalStorage } from '../request-scope';
import type { ApiHonoEnv } from './api-hono-types';

/**
 * Per-request Hyperdrive Postgres + Better Auth + session auth (AsyncLocalStorage for patch-db host).
 */
export function createRequestDbMiddleware(
  secretStore: SecretStore
): MiddlewareHandler<ApiHonoEnv> {
  return async (c, next) => {
    if (c.req.path === '/health') {
      return next();
    }

    const hyper = c.env.HYPERDRIVE;
    if (hyper === undefined || hyper === null) {
      throw new ConfigurationError(
        'HYPERDRIVE Worker binding is required (configure apps/api/wrangler.toml)'
      );
    }
    const cs = hyper.connectionString;
    assert.nonEmptyString(
      cs,
      'Hyperdrive connectionString must be a non-empty string'
    );

    const { client, sqlClient } = await openRequestDb(cs);
    const patchDb = createRequestPatchDb(sqlClient);
    const { auth: betterAuth, dispose } = await createBetterAuthRequestStack(
      secretStore,
      cs
    );
    const bearerPorts = {
      sessionClaims: new SessionClaimsBetterAuthAdapter(betterAuth),
      accountProvisioning: betterAuthAccountProvisioning,
    };
    const sessionAuth = createSessionAuth(bearerPorts);

    const store = { patchDb, sessionAuth };
    return await apiRequestAsyncLocalStorage.run(store, async () => {
      c.set('patchDb', patchDb);
      c.set('sessionAuth', sessionAuth);
      c.set('betterAuth', betterAuth);
      c.set('bearerAuth', bearerPorts);
      try {
        await next();
      } finally {
        await dispose();
        // Close the per-request Postgres TCP session. Without this the socket
        // leaks for the lifetime of the Worker isolate; in local dev that
        // saturates PGlite's connection slots and surfaces as
        // "Connection terminated unexpectedly" on subsequent requests.
        await client.end().catch(() => {
          /* swallow: connection may already be closed by remote */
        });
      }
    });
  };
}
