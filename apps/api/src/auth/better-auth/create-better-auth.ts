import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { expo } from '@better-auth/expo';
import { neon } from '@neondatabase/serverless';
import { betterAuth } from 'better-auth';
import { bearer } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/neon-http';
import type { SecretStore } from '@gamezilla/lib/secret-store';
import { ConfigurationError } from '../../config/env';
import { ApiSecretName } from '../../config/secret-names';
import { authDrizzleSchema } from './schema';

export async function createBetterAuthInstance(secretStore: SecretStore) {
  const dbUrl = await secretStore.getRequired(ApiSecretName.dbUrl);
  if (dbUrl.startsWith('http')) {
    throw new ConfigurationError(
      'Better Auth requires a Postgres connection string in DB_URL (PlanetScale/Neon), not an HTTP PGlite URL.'
    );
  }

  const secret = await secretStore.getRequired(ApiSecretName.betterAuthSecret);
  const googleClientId = await secretStore.getRequired(
    ApiSecretName.googleWebClientId
  );
  const googleClientSecret = await secretStore.getRequired(
    ApiSecretName.googleWebClientSecret
  );
  const apiUrlRaw = await secretStore.getRequired(ApiSecretName.apiUrl);
  const apiOrigin = apiUrlRaw.replace(/\/$/, '');
  const baseURL = `${apiOrigin}/api/auth`;

  const sql = neon(dbUrl);
  const db = drizzle(sql, { schema: authDrizzleSchema });

  return betterAuth({
    appName: 'gamezilla',
    baseURL,
    basePath: '/api/auth',
    secret: secret.trim(),
    trustedOrigins: [
      apiOrigin,
      'http://127.0.0.1:8788',
      'http://localhost:8788',
      'https://localhost:8788',
      'myapp://',
      'myapp://*',
      'exp://**',
    ],
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: authDrizzleSchema,
    }),
    emailAndPassword: { enabled: false },
    socialProviders: {
      google: {
        clientId: googleClientId.trim(),
        clientSecret: googleClientSecret.trim(),
      },
    },
    plugins: [bearer(), expo()],
    user: { modelName: 'auth_user' },
    session: { modelName: 'auth_session' },
    account: { modelName: 'auth_account' },
    verification: { modelName: 'auth_verification' },
  });
}
