import type { SignInCredentials } from '@pkgs/auth/shared/sign-in-strategy';
import { useCallback } from 'react';

import { useAuthClientPort } from './auth-client-provider';
import type { SignInTriggerResult } from './sign-in-trigger';

/**
 * Triggers hosted sign-in via {@link AuthClientPort.signIn}.
 * Google uses OAuth redirect; Dev social completes in-place via JSON POST.
 */
export function useSignIn(): {
  signInWithGoogle: () => Promise<SignInTriggerResult>;
  signInWithDev: (
    credentials: SignInCredentials
  ) => Promise<SignInTriggerResult>;
} {
  const port = useAuthClientPort();

  const signInWithGoogle = useCallback(async () => {
    await port.signIn('oauth-google');
    return 'completed' as const;
  }, [port]);

  const signInWithDev = useCallback(
    async (credentials: SignInCredentials) => {
      await port.signIn('oauth-dev', credentials);
      return 'completed' as const;
    },
    [port]
  );

  return { signInWithGoogle, signInWithDev };
}
