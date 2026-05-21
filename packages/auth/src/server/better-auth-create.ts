import { expo } from '@better-auth/expo';
import type { SecretStore } from '@gamezilla/secret-store';
import { sanitizePostgresUrlForNodePg } from '@gamezilla/sql-client/sanitize-postgres-url-for-node-pg';
import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { loadBetterAuthSecretsWorker } from './better-auth-load-secrets';

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
  /** Ends per-request Kysely pool (Hyperdrive-friendly `max: 1`). */
  readonly dispose: () => Promise<void>;
};

/**
 * Per-request Better Auth + Kysely over Hyperdrive (`connectionString`).
 * Uses a short-lived `pg.Pool({ max: 1 })` because `PostgresDialect` requires a pool.
 */
export async function createBetterAuthRequestStack(
  secretStore: SecretStore,
  hyperdriveConnectionString: string
): Promise<BetterAuthRequestStack> {
  const cfg = await loadBetterAuthSecretsWorker(secretStore);
  const pool = new Pool({
    connectionString: sanitizePostgresUrlForNodePg(hyperdriveConnectionString),
    max: 1,
  });
  await pool.query('SELECT 1');
  const db = new Kysely({ dialect: new PostgresDialect({ pool }) });

  const auth = betterAuth({
    appName: cfg.appName,
    baseURL: cfg.baseURL,
    basePath: '/api/auth',
    secret: cfg.secret,
    trustedOrigins: [...cfg.trustedOrigins],
    database: { db, type: 'postgres' },
    emailAndPassword: { enabled: false },
    socialProviders: {
      google: {
        clientId: cfg.googleClientId,
        clientSecret: cfg.googleClientSecret,
      },
    },
    plugins: [bearer(), expo()],
  }) as HostedBetterAuth;

  return {
    auth,
    dispose: async () => {
      await db.destroy();
    },
  };
}
