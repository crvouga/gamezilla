import { loggerAtom } from '@gamezilla/client/runtime/atoms';
import { getDefaultStore } from 'jotai';
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
 * Sign-out clears the remote session; the session bridge mirrors local atoms.
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
    const store = getDefaultStore();
    const log = store.get(loggerAtom);
    try {
      await hostedSignOut();
    } catch (err) {
      log.warn('Hosted sign-out failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      await clearLocalAuthMirrors();
    }
  };
}
