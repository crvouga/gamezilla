import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { neon } from '@neondatabase/serverless';
import { betterAuth } from 'better-auth';
import { drizzle } from 'drizzle-orm/neon-http';
import { createDopplerSecretStoreForScripts } from '@gamezilla/lib/secret-store';
import { ApiSecretName } from '../../../config/secret-names';

const sql = neon('postgresql://stub:stub@127.0.0.1:5432/stub');
const db = drizzle(sql);

const secretStore = createDopplerSecretStoreForScripts();
const [googleClientId, googleClientSecret] = await Promise.all([
  secretStore.getRequired(ApiSecretName.googleWebClientId),
  secretStore.getRequired(ApiSecretName.googleWebClientSecret),
]);

/** Stub for `bunx @better-auth/cli generate` only — not used at runtime. */
export const auth = betterAuth({
  baseURL: 'http://127.0.0.1:8788',
  database: drizzleAdapter(db, { provider: 'pg' }),
  emailAndPassword: { enabled: false },
  socialProviders: {
    google: {
      clientId: googleClientId.trim(),
      clientSecret: googleClientSecret.trim(),
    },
  },
});
