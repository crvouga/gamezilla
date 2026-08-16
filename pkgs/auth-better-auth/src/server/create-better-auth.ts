import { expo } from '@better-auth/expo';
import type { SqlClient } from '@pkgs/sql-client/interface';
import type { Pool } from '@pkgs/sql-client/postgres/pg-types';
import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins';

import { BETTER_AUTH_TABLE_NAMES } from './better-auth-table-names';
import { exposeBearerFromSessionCookie } from './expose-bearer-from-session-cookie';
import { SqlClientSqliteDialect } from './sql-client-sqlite-dialect';

export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;

/**
 * better-sqlite3 Database (Jest / Node sims). Structural only — do not import
 * `better-sqlite3` here (Metro would resolve it into Expo web).
 */
export type BetterSqliteDatabase = object;

/**
 * Composition-root database handle for Better Auth.
 * Prefer `sql-client` for sims / Expo web (async engines). Keep `sqlite`
 * (better-sqlite3) for Jest until call sites migrate.
 */
export type BetterAuthDatabase =
  | { readonly kind: 'postgres'; readonly pool: Pool }
  | { readonly kind: 'sqlite'; readonly db: BetterSqliteDatabase }
  | { readonly kind: 'sql-client'; readonly client: SqlClient };

export type CreateBetterAuthConfig = {
  readonly database: BetterAuthDatabase;
  readonly secret: string;
  readonly baseURL: string;
  /** When both id and secret are non-null, Google OAuth is registered. */
  readonly googleClientId: string | null;
  readonly googleClientSecret: string | null;
  readonly trustedOrigins: readonly string[];
  /** Enable email/password (local/dev-friendly sign-in). */
  readonly enableEmailPassword?: boolean;
};

function trimOrNull(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const t = value.trim();
  return t.length > 0 ? t : null;
}

function resolveBetterAuthDatabase(
  database: BetterAuthDatabase
):
  | Pool
  | BetterSqliteDatabase
  | { dialect: SqlClientSqliteDialect; type: 'sqlite' } {
  if (database.kind === 'postgres') return database.pool;
  if (database.kind === 'sqlite') return database.db;
  return {
    dialect: new SqlClientSqliteDialect({ client: database.client }),
    type: 'sqlite',
  };
}

/**
 * Per-request Better Auth instance bound to the request DB (Postgres pool,
 * better-sqlite3, or SqlClient dialect). Branch only at composition roots.
 */
export function createBetterAuth(config: CreateBetterAuthConfig) {
  const googleClientId = trimOrNull(config.googleClientId);
  const googleClientSecret = trimOrNull(config.googleClientSecret);
  const googleConfigured =
    googleClientId !== null && googleClientSecret !== null;

  return betterAuth({
    database: resolveBetterAuthDatabase(config.database),
    secret: config.secret,
    baseURL: config.baseURL,
    trustedOrigins: [...config.trustedOrigins],
    user: { modelName: BETTER_AUTH_TABLE_NAMES.user },
    session: { modelName: BETTER_AUTH_TABLE_NAMES.session },
    account: { modelName: BETTER_AUTH_TABLE_NAMES.account },
    verification: { modelName: BETTER_AUTH_TABLE_NAMES.verification },
    ...(googleConfigured
      ? {
          socialProviders: {
            google: {
              clientId: googleClientId,
              clientSecret: googleClientSecret,
              prompt: 'select_account' as const,
            },
          },
        }
      : { socialProviders: {} }),
    emailAndPassword: {
      enabled: config.enableEmailPassword === true,
    },
    // bearer first (copies Set-Cookie → set-auth-token); expose plugin covers
    // cookie-only responses (OAuth return → get-session) that skip Set-Cookie.
    plugins: [bearer(), exposeBearerFromSessionCookie(), expo()],
  });
}
