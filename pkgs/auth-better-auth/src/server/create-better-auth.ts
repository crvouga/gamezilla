import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins';
import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { Pool } from 'pg';

import { BETTER_AUTH_TABLE_NAMES } from './better-auth-table-names';
import { exposeBearerFromSessionCookie } from './expose-bearer-from-session-cookie';

export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;

/** Composition-root database handle for Better Auth (Postgres pool or SQLite). */
export type BetterAuthDatabase =
  | { readonly kind: 'postgres'; readonly pool: Pool }
  | { readonly kind: 'sqlite'; readonly db: BetterSqliteDatabase };

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
): Pool | BetterSqliteDatabase {
  return database.kind === 'postgres' ? database.pool : database.db;
}

/**
 * Per-request Better Auth instance bound to the request DB (Postgres pool or
 * better-sqlite3). Branch only at composition roots.
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
