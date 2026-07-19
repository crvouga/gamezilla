import { useCallback } from 'react';

import { useAuthClientPort } from './auth-client-provider';
import type { SignInTriggerResult } from './sign-in-trigger';

/**
 * Adds another signed-in account via SSO without clearing existing sessions.
 * Requires auth-provider multi-session support.
 */
export function useAddAccount(): () => Promise<SignInTriggerResult> {
  const port = useAuthClientPort();

  return useCallback(async () => {
    await port.addAccount('oauth-google');
    return 'completed';
  }, [port]);
}
