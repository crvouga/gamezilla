import { assert } from '@gamezilla/lib/assert';
import type { SecretStore } from '@gamezilla/lib/secret-store';
import type { MiddlewareHandler } from 'hono';
import { betterAuthAccountProvisioning } from '@gamezilla/auth/server/better-auth-account-provisioning';
import { createBetterAuthRequestStack } from '@gamezilla/auth/server/better-auth-create';
import { SessionClaimsBetterAuthAdapter } from '@gamezilla/auth/server/better-auth-session-claims-port';
import { createSessionAuth } from '@gamezilla/auth/server/session-middleware';
import type { AuthContext } from '@gamezilla/auth/server/types';
import { loadMemberOfSpaceIds } from '@gamezilla/spaces/server/load-member-of-space-ids';
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
): MiddlewareHandler<ApiHonoEnv<AuthContext>> {
  return async (c, next) => {
    if (c.req.path === '/health') {
      return next();
    }

    const hyper = c.env.HYPERDRIVE;
    if (hyper === undefined || hyper === null) {
      throw new ConfigurationError(
        'HYPERDRIVE Worker binding is required (configure packages/api/wrangler.toml)'
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
    const sessionAuth = createSessionAuth({
      ...bearerPorts,
      loadMemberOfSpaceIds,
    });

    const store = { patchDb, sessionAuth };
    return await apiRequestAsyncLocalStorage.run(store, async () => {
      c.set('patchDb', patchDb);
      c.set('sessionAuth', sessionAuth);
      c.set('betterAuth', betterAuth);
      c.set('bearerAuth', bearerPorts);
      try {
        await next();
      } finally {
        // Defer Postgres + Better Auth cleanup beyond the response.
        // `pg.Client.end()` does not resolve under Workers' `nodejs_compat`
        // socket emulation when peering with the local PGlite socket, so
        // awaiting it inline would block the Hono response forever.
        c.executionCtx.waitUntil(
          (async () => {
            await dispose().catch(() => {});
            await client.end().catch(() => {});
          })()
        );
      }
    });
  };
}
