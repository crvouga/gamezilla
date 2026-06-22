import { expo } from '@better-auth/expo';
import type { SecretStore } from '@pkgs/secret-store';
import { createNeonPool } from '@pkgs/sql-client/neon-connect';
import {
  createPgPool,
  isLoopbackPostgresUrl,
} from '@pkgs/sql-client/postgres-connect';
import type { PostgresDbScope } from '@pkgs/sql-client/postgres-schema';
import { betterAuth, type BetterAuthPlugin } from 'better-auth';
import { bearer } from 'better-auth/plugins';
import { genericOAuth } from 'better-auth/plugins/generic-oauth';
import { Kysely, PostgresDialect } from 'kysely';
import {
  isLocalApiOrigin,
  loadBetterAuthSecretsWorker,
} from './better-auth-load-secrets';
import { devIdpProviderConfig } from './dev-idp-provider';

/** Narrow surface — Better Auth's `Auth` generic does not match our `createBetterAuth` options. */
export type HostedBetterAuth = {
  handler: (request: Request) => Promise<Response>;
  readonly api: {
    getSession: (args: { headers: Headers }) => Promise<{
      user?: {
        id?: unknown;
        email?: unknown;
        name?: unknown;
        image?: unknown;
      };
    } | null>;
    listUserAccounts: (args: { headers: Headers }) => Promise<
      ReadonlyArray<{
        id?: unknown;
        providerId?: unknown;
        accountId?: unknown;
        userId?: unknown;
        createdAt?: unknown;
        updatedAt?: unknown;
        scopes?: unknown;
      }>
    >;
  };
};

export type BetterAuthRequestStack = {
  readonly auth: HostedBetterAuth;
  /** Ends per-request Kysely pool (Neon HTTP `max: 1`). */
  readonly dispose: () => Promise<void>;
};

/**
 * Per-request Better Auth + Kysely over Neon HTTP (`DATABASE_URL` from Vault).
 * Uses a short-lived Neon HTTP `Pool({ max: 1 })` because `PostgresDialect`
 * requires a pool.
 */
export async function createBetterAuthRequestStack(
  secretStore: SecretStore,
  databaseUrl: string,
  options: {
    readonly dbScope: PostgresDbScope;
    readonly apiUrlOverride?: string | null;
  }
): Promise<BetterAuthRequestStack> {
  const cfg = await loadBetterAuthSecretsWorker(
    secretStore,
    options.apiUrlOverride
  );
  const poolArgs = {
    connectionString: databaseUrl,
    dbScope: options.dbScope,
    max: 1 as const,
  };
  const { pool } = isLoopbackPostgresUrl(databaseUrl)
    ? createPgPool(poolArgs)
    : createNeonPool(poolArgs);
  await pool.query('SELECT 1');
  const db = new Kysely({ dialect: new PostgresDialect({ pool }) });

  const plugins: BetterAuthPlugin[] = [bearer(), expo()];
  if (isLocalApiOrigin(cfg.apiOrigin)) {
    plugins.push(genericOAuth({ config: [devIdpProviderConfig()] }));
  }

  const localApi = isLocalApiOrigin(cfg.apiOrigin);

  const auth = betterAuth({
    appName: cfg.appName,
    baseURL: cfg.baseURL,
    basePath: '/api/auth',
    secret: cfg.secret,
    trustedOrigins: [...cfg.trustedOrigins],
    database: { db, type: 'postgres' },
    // Local: keep DB-backed OAuth state but skip the signed `state` cookie check —
    // Expo Web (cross-origin fetch) and ASWebAuthenticationSession often never send
    // that cookie on callback; verification rows in Postgres are enough.
    // Production native: cookie strategy so @better-auth/expo can replay `oauth_state`
    // from SecureStore through `/expo-authorization-proxy`.
    account: localApi
      ? { skipStateCookieCheck: true }
      : { storeStateStrategy: 'cookie' },
    emailAndPassword: { enabled: false },
    socialProviders: {
      google: {
        clientId: cfg.googleClientId,
        clientSecret: cfg.googleClientSecret,
      },
    },
    plugins,
  }) as HostedBetterAuth;

  return {
    auth,
    dispose: async () => {
      await db.destroy();
    },
  };
}
