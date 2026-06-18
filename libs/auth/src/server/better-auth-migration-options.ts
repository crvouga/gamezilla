import { expo } from '@better-auth/expo';
import type { SecretStore } from '@pkgs/secret-store';
import type { BetterAuthOptions, BetterAuthPlugin } from 'better-auth';
import { bearer } from 'better-auth/plugins';
import { genericOAuth } from 'better-auth/plugins/generic-oauth';

import { isLocalApiOrigin } from '../shared/local-api-origin';
import { devIdpProviderConfig } from './dev-idp-provider';

/** Better Auth options (minus `database`) for `getMigrations` / scripts. */
export async function loadBetterAuthOptionsForMigration(
  store: SecretStore,
  apiOrigin: string
): Promise<Omit<BetterAuthOptions, 'database'>> {
  const secret = (await store.getRequired('BETTER_AUTH_SECRET'))
    .readSecretValue()
    .trim();
  const normalizedApiOrigin = apiOrigin.replace(/\/$/, '');
  const baseURL = `${normalizedApiOrigin}/api/auth`;
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
  if (isLocalApiOrigin(normalizedApiOrigin)) {
    plugins.push(genericOAuth({ config: [devIdpProviderConfig()] }));
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
