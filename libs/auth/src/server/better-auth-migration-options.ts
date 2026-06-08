import { expo } from '@better-auth/expo';
import type { SecretStore } from '@pkgs/secret-store';
import type { BetterAuthOptions, BetterAuthPlugin } from 'better-auth';
import { bearer } from 'better-auth/plugins';
import { genericOAuth } from 'better-auth/plugins/generic-oauth';

import { isLocalApiOrigin } from './better-auth-load-secrets';
import { devIdpProviderConfig } from './dev-idp-provider';

/** Better Auth options (minus `database`) for `getMigrations` / scripts. */
export async function loadBetterAuthOptionsForMigration(
  store: SecretStore
): Promise<Omit<BetterAuthOptions, 'database'>> {
  const secret = (await store.getRequired('BETTER_AUTH_SECRET'))
    .readSecretValue()
    .trim();
  const apiUrlRaw = (await store.getRequired('API_URL')).readSecretValue();
  const apiOrigin = apiUrlRaw.replace(/\/$/, '');
  const baseURL = `${apiOrigin}/api/auth`;
  const googleClientId = (
    await store.getRequired('WEB_CLIENT_GOOGLE_CLIENT_ID')
  )
    .readSecretValue()
    .trim();
  const googleClientSecret = (
    await store.getRequired('WEB_CLIENT_GOOGLE_CLIENT_SECRET')
  )
    .readSecretValue()
    .trim();
  const plugins: BetterAuthPlugin[] = [bearer(), expo()];
  if (isLocalApiOrigin(apiOrigin)) {
    plugins.push(genericOAuth({ config: [devIdpProviderConfig(baseURL)] }));
  }
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
    plugins,
  };
}
