import {
  INHOUSE_AUTH_PROVIDER,
  inhouseAuthProviderWith,
} from '@pkgs/auth-inhouse-server-ts/inhouse-auth-provider';
import type { AuthProviderModule } from '@pkgs/auth-root-shared-ts/auth-provider-module';
import type { HarnessComposition } from './composition';

/**
 * The auth service a composition's API instances run: its own when it
 * configures one, otherwise the in-house IdP, with emailed sign-in links
 * only when a sub of the composition keeps them.
 */
export function harnessAuthProvider(
  composition: HarnessComposition
): AuthProviderModule {
  if (composition.authProvider !== undefined) return composition.authProvider;
  return composition.emailLinks === undefined
    ? INHOUSE_AUTH_PROVIDER
    : inhouseAuthProviderWith({ emailLinks: composition.emailLinks });
}
