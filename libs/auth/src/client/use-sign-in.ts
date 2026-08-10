import type { SignInCredentials } from '@pkgs/auth/shared/sign-in-strategy';
import { useCallback } from 'react';

import { useAuthClientPort } from './auth-client-provider';
import type { SignInTriggerResult } from './sign-in-trigger';

/**
 * Triggers hosted sign-in via {@link AuthClientPort.signIn}.
 * Google uses OAuth redirect; email/password completes in-place.
 */
export function useSignIn(): {
  signInWithGoogle: () => Promise<SignInTriggerResult>;
  signInWithEmail: (
    credentials: SignInCredentials
  ) => Promise<SignInTriggerResult>;
} {
  const port = useAuthClientPort();

  const signInWithGoogle = useCallback(async () => {
    await port.signIn('oauth-google');
    return 'completed' as const;
  }, [port]);

  const signInWithEmail = useCallback(
    async (credentials: SignInCredentials) => {
      await port.signIn('email-password', credentials);
      return 'completed' as const;
    },
    [port]
  );

  return { signInWithGoogle, signInWithEmail };
}
