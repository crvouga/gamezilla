import { getMigrations } from 'better-auth/db/migration';
import type { Pool } from 'pg';

import { createBetterAuth } from './create-better-auth';

export type RunBetterAuthMigrationsArgs = {
  readonly database: Pool;
  readonly secret: string;
  readonly baseURL: string;
};

/**
 * Applies Better Auth Kysely DDL (`better_auth_user` / session / account / verification).
 * Uses placeholder Google credentials — schema is independent of OAuth secrets.
 */
export async function runBetterAuthMigrations(
  args: RunBetterAuthMigrationsArgs
): Promise<void> {
  const auth = createBetterAuth({
    database: args.database,
    secret: args.secret,
    baseURL: args.baseURL,
    googleClientId: null,
    googleClientSecret: null,
    trustedOrigins: [args.baseURL],
    enableEmailPassword: false,
  });
  const { runMigrations } = await getMigrations(auth.options);
  await runMigrations();
}
