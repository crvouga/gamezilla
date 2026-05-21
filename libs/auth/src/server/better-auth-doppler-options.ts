import { expo } from '@better-auth/expo';
import type { SecretStore } from '@pkgs/secret-store';
import type { BetterAuthOptions } from 'better-auth';
import { bearer } from 'better-auth/plugins';

/** Better Auth options (minus `database`) for `getMigrations` / scripts. */
export async function loadBetterAuthOptionsForMigration(
  store: SecretStore
): Promise<Omit<BetterAuthOptions, 'database'>> {
  const secret = (await store.getRequired('BETTER_AUTH_SECRET')).trim();
  const apiUrlRaw = await store.getRequired('API_URL');
  const apiOrigin = apiUrlRaw.replace(/\/$/, '');
  const baseURL = `${apiOrigin}/api/auth`;
  const googleClientId = (
    await store.getRequired('WEB_CLIENT_GOOGLE_CLIENT_ID')
  ).trim();
  const googleClientSecret = (
    await store.getRequired('WEB_CLIENT_GOOGLE_CLIENT_SECRET')
  ).trim();
  return {
    secret,
    baseURL,
    basePath: '/api/auth',
    emailAndPassword: { enabled: false },
    socialProviders: {
      google: {
        clientId: googleClientId,
        clientSecret: googleClientSecret,
      },
    },
    plugins: [bearer(), expo()],
  };
}
