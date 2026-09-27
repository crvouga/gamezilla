/**
 * The in-house IdP as an auth service. The product holds it exactly as it
 * would hold Clerk or WorkOS: through {@link AuthProviderModule}. It happens
 * to be hosted on the product API's origin (its `/auth/*` endpoints ride
 * along as {@link AuthProvider.handler}) and to keep its tables in the
 * product's Postgres (`idp_*`), but the product reads neither directly.
 */
import type {
  AuthProvider,
  AuthProviderEnv,
  AuthProviderModule,
} from '@pkgs/auth/server';
import { OAUTH_PROVIDER_IDS } from '@pkgs/auth/shared';
import { Hono } from 'hono';

import { IDP_PROVIDER_LABEL } from '../shared/provider-label';
import { buildAuthTrustedOrigins } from '../shared/trusted-origins';
import { AuthPostgresDatabaseMigration } from './auth-postgres-database-migration';
import { createAuthApp } from './create-auth-app';
import { createAuthServerAdapter } from './create-auth-server-adapter';
import { readInhouseAuthConfig } from './inhouse-auth-config';

/** Where the IdP's endpoints sit under the API path. */
const AUTH_PATH_PREFIX = '/auth';

async function createInhouseAuthProvider(
  env: AuthProviderEnv
): Promise<AuthProvider> {
  const config = await readInhouseAuthConfig(env);
  const app = createAuthApp({
    getSql: env.getSql,
    clock: env.clock,
    createId: env.createId,
    http: env.http,
    secret: config.secret,
    baseURL: env.apiOrigin,
    publicPathPrefix: env.apiPathPrefix,
    trustedOrigins: buildAuthTrustedOrigins({
      apiBaseURL: env.apiOrigin,
      clientWebOrigins: env.clientOrigins,
    }),
    providers: config.providers,
    onUserChanged: env.onUserChanged,
    ...(config.callbackRelay === undefined
      ? {}
      : { callbackRelay: config.callbackRelay }),
    ...(config.syntheticMonitor === undefined
      ? {}
      : { syntheticMonitor: config.syntheticMonitor }),
  });
  // The handler receives the request's full URL, prefix included.
  const hosted =
    env.apiPathPrefix === '' ? app : new Hono().route(env.apiPathPrefix, app);
  return {
    server: createAuthServerAdapter({
      getSql: env.getSql,
      clock: env.clock,
      createId: env.createId,
      secret: config.secret,
    }),
    signInMethods: OAUTH_PROVIDER_IDS.filter(
      (id) => config.providers[id] !== undefined
    ),
    handler: {
      pathPrefix: AUTH_PATH_PREFIX,
      fetch: async (request) => await hosted.fetch(request),
    },
  };
}

export const INHOUSE_AUTH_PROVIDER: AuthProviderModule = {
  provider: IDP_PROVIDER_LABEL,
  create: createInhouseAuthProvider,
  postgresMigration: ({ dbScope }) =>
    new AuthPostgresDatabaseMigration({
      dbScope,
      skipAdvisoryLock: true,
      alreadyInTransaction: false,
    }),
};
