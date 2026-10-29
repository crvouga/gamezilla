/**
 * The in-house IdP as an auth service. The product holds it exactly as it
 * would hold Clerk or WorkOS: through {@link AuthProviderModule}. It happens
 * to be hosted on the product API's origin (its `/auth/*` endpoints ride
 * along as {@link AuthProvider.handler}) and to keep its tables in the
 * product's Postgres (`idp_*`), but the product reads neither directly.
 */

import { IDP_PROVIDER_LABEL } from '@pkgs/auth-inhouse-shared-ts/provider-label';
import { buildAuthTrustedOrigins } from '@pkgs/auth-inhouse-shared-ts/trusted-origins';
import type {
  AuthProvider,
  AuthProviderEnv,
  AuthProviderModule,
} from '@pkgs/auth-root-shared-ts/auth-provider-module';
import { OAUTH_PROVIDER_IDS } from '@pkgs/auth-root-shared-ts/sign-in-method';
import { Hono } from 'hono';
import { createAuthApp } from './create-auth-app';
import { createAuthServerAdapter } from './create-auth-server-adapter';
import type { EmailLinkDelivery } from './email-link-delivery';
import { readInhouseAuthConfig } from './inhouse-auth-config';
import { reconcileIdpPostgres } from './reconcile-idp-postgres';

/** Where the IdP's endpoints sit under the API path. */
const AUTH_PATH_PREFIX = '/auth';

/** What a deployment chooses about the in-house IdP beyond its secrets. */
export type InhouseAuthProviderOptions = {
  /** How long a session lasts, independently of proof freshness. */
  readonly sessionLifetimeMs?: number;
  /**
   * Where emailed sign-in links go, built from the same env as the service
   * (its HTTP egress and secrets). Absent → the service has no email sign-in.
   */
  readonly emailLinks?: (
    env: AuthProviderEnv
  ) => EmailLinkDelivery | Promise<EmailLinkDelivery>;
};

async function createInhouseAuthProvider(
  env: AuthProviderEnv,
  options: InhouseAuthProviderOptions
): Promise<AuthProvider> {
  const config = await readInhouseAuthConfig(env);
  const { sessionLifetimeMs } = options;
  const emailLinks = await options.emailLinks?.(env);
  const app = createAuthApp({
    getSql: env.getSql,
    clock: env.clock,
    createId: env.createId,
    http: env.http,
    secret: config.secret,
    ...(sessionLifetimeMs === undefined ? {} : { sessionLifetimeMs }),
    baseURL: env.apiOrigin,
    publicPathPrefix: env.apiPathPrefix,
    trustedOrigins: buildAuthTrustedOrigins({
      apiBaseURL: env.apiOrigin,
      clientWebOrigins: env.clientOrigins,
      clientSchemes: env.clientSchemes,
    }),
    providers: config.providers,
    onUserChanged: env.onUserChanged,
    ...(config.callbackRelay === undefined
      ? {}
      : { callbackRelay: config.callbackRelay }),
    ...(config.syntheticMonitor === undefined
      ? {}
      : { syntheticMonitor: config.syntheticMonitor }),
    ...(emailLinks === undefined ? {} : { emailLinks }),
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
    signInMethods: [
      ...OAUTH_PROVIDER_IDS.filter((id) => config.providers[id] !== undefined),
      ...(emailLinks === undefined ? [] : (['email'] as const)),
    ],
    handler: {
      pathPrefix: AUTH_PATH_PREFIX,
      fetch: async (request) => await hosted.fetch(request),
    },
  };
}

/** The in-house IdP as a deployment configures it. */
export function inhouseAuthProviderWith(
  options: InhouseAuthProviderOptions
): AuthProviderModule {
  return {
    provider: IDP_PROVIDER_LABEL,
    create: (env) => createInhouseAuthProvider(env, options),
    reconcilePostgres: ({ sqlClient, dbScope }) =>
      reconcileIdpPostgres(sqlClient, {
        dbScope,
        skipAdvisoryLock: true,
        alreadyInTransaction: false,
      }),
  };
}

/** The in-house IdP with its defaults: social providers only, no email sign-in. */
export const INHOUSE_AUTH_PROVIDER: AuthProviderModule =
  inhouseAuthProviderWith({});

/** Deployments can choose a session lifetime independently of proof freshness. */
export function inhouseAuthProvider(
  sessionLifetimeMs: number
): AuthProviderModule {
  return inhouseAuthProviderWith({ sessionLifetimeMs });
}
