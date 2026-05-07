import { betterAuth } from 'better-auth';
import { createDopplerSecretStoreForScripts } from '@gamezilla/lib/secret-store';
import { getDb } from '../../../patch-db/sql-client';
import { loadBetterAuthSecrets } from '../load-better-auth-secrets';
import { createSqlClientBetterAuthAdapter } from '../sql-client-better-auth-adapter';

const secretStore = createDopplerSecretStoreForScripts();
const cfg = await loadBetterAuthSecrets(secretStore);
const sql = getDb(cfg.dbUrl);
await sql.connect();

/** Stub for `bunx @better-auth/cli generate` only — not used at runtime. */
export const auth = betterAuth({
  appName: cfg.appName,
  baseURL: cfg.baseURL,
  secret: cfg.secret,
  trustedOrigins: [...cfg.trustedOrigins],
  database: createSqlClientBetterAuthAdapter(sql),
  emailAndPassword: { enabled: false },
  socialProviders: {
    google: {
      clientId: cfg.googleClientId,
      clientSecret: cfg.googleClientSecret,
    },
  },
});
