import { expo } from '@better-auth/expo';
import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins';
import type { Pool } from 'pg';

import { exposeBearerFromSessionCookie } from './expose-bearer-from-session-cookie';

export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;

export type CreateBetterAuthConfig = {
  readonly database: Pool;
  readonly secret: string;
  readonly baseURL: string;
  readonly googleClientId: string;
  readonly googleClientSecret: string;
  readonly trustedOrigins: readonly string[];
  /** Enable email/password for dev E2E session minting. */
  readonly enableEmailPassword?: boolean;
};

/**
 * Per-request Better Auth instance bound to the Worker’s pinned Postgres pool.
 */
export function createBetterAuth(config: CreateBetterAuthConfig) {
  return betterAuth({
    database: config.database,
    secret: config.secret,
    baseURL: config.baseURL,
    trustedOrigins: [...config.trustedOrigins],
    socialProviders: {
      google: {
        clientId: config.googleClientId,
        clientSecret: config.googleClientSecret,
        prompt: 'select_account',
      },
    },
    emailAndPassword: {
      enabled: config.enableEmailPassword === true,
    },
    // bearer first (copies Set-Cookie → set-auth-token); expose plugin covers
    // cookie-only responses (OAuth return → get-session) that skip Set-Cookie.
    plugins: [bearer(), exposeBearerFromSessionCookie(), expo()],
  });
}
