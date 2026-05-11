import { getRegisteredClientStore } from './client-store-register';
import { clearLocalAuthMirrors } from './local-auth-cleanup';

export interface AuthService {
  startHostedSignIn(): Promise<void>;
  signOut(): Promise<void>;
}

type CreateAuthServiceDeps = {
  /** Hosted SSO flow — must activate the created session in the provider SDK. */
  startHostedSignIn: () => Promise<void>;
  hostedSignOut: () => Promise<void>;
};

/**
 * Hosted provider handles credentials; local PatchDB session rows are legacy-only.
 * Sign-out clears the remote session, then always runs {@link clearLocalAuthMirrors}
 * (success or failure) so local state and PatchDB session mirrors are not left stale.
 */
export function createAuthService(deps: CreateAuthServiceDeps): AuthService {
  return {
    startHostedSignIn: deps.startHostedSignIn,
    signOut: createSignOutHandler(deps),
  };
}

function createSignOutHandler(
  deps: Pick<CreateAuthServiceDeps, 'hostedSignOut'>
): AuthService['signOut'] {
  const { hostedSignOut } = deps;
  return async function signOut(): Promise<void> {
    const log = getRegisteredClientStore().getLogger();
    try {
      await hostedSignOut();
    } catch (err) {
      log.warn('Hosted sign-out failed', {
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      await clearLocalAuthMirrors();
    }
  };
}
