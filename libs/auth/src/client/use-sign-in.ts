import { useCallback } from 'react';

import { useAuthClientPort } from './auth-client-provider';
import type { SignInTriggerResult } from './sign-in-trigger';

/**
 * Triggers hosted Google sign-in via {@link AuthClientPort.signIn}. Server-side
 * provisioning + local secure-storage writes happen inside `<AuthBridge />` once
 * the session settles; this hook only starts the OAuth flow.
 */
export function useSignIn(): () => Promise<SignInTriggerResult> {
  const port = useAuthClientPort();

  return useCallback(async () => {
    await port.signIn('oauth-google');
    return 'completed';
  }, [port]);
}
