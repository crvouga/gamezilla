import { expo } from '@better-auth/expo';
import type { SecretStore } from '@gamezilla/lib/secret-store';
import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins';
import { getDb } from '../../patch-db/sql-client';
import { loadBetterAuthSecrets } from './load-better-auth-secrets';
import { createSqlClientBetterAuthAdapter } from './sql-client-better-auth/adapter';

export async function createBetterAuthInstance(secretStore: SecretStore) {
  const cfg = await loadBetterAuthSecrets(secretStore);
  const sql = getDb(cfg.dbUrl);
  await sql.connect();

  return betterAuth({
    appName: cfg.appName,
    baseURL: cfg.baseURL,
    basePath: '/api/auth',
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
    plugins: [bearer(), expo()],
    user: { modelName: 'auth_user' },
    session: { modelName: 'auth_session' },
    account: { modelName: 'auth_account' },
    verification: { modelName: 'auth_verification' },
  });
}
