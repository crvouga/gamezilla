import { useCallback } from 'react';

import { useAuthClientPort } from './auth-client-provider';

/** Activates another local auth session (multi-account switch). */
export function useSwitchAccount(): (sessionId: string) => Promise<void> {
  const port = useAuthClientPort();

  return useCallback(
    async (sessionId: string) => {
      await port.switchAccount(sessionId);
    },
    [port]
  );
}
