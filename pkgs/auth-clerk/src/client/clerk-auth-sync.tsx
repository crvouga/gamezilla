import { useAuth, useClerk, useSessionList, useSSO } from '@clerk/expo';
import { useCallback, useEffect } from 'react';

import { ensureClerkActiveSession } from './clerk-ensure-active-session';
import type { ClerkSetActive } from './clerk-ensure-active-session';
import { setClerkAuthRuntime } from './clerk-auth-runtime';

function useClerkSetActive(): ClerkSetActive {
  const clerk = useClerk();
  return useCallback(
    async (params: { session: string }) => {
      if (typeof clerk.setActive !== 'function') return;
      await clerk.setActive(params);
    },
    [clerk]
  );
}

export function ClerkAuthSync(): null {
  const { startSSOFlow } = useSSO();
  const { signOut, getToken, isLoaded, isSignedIn, sessionId } = useAuth();
  const setActive = useClerkSetActive();
  const { sessions, isLoaded: sessionsLoaded } = useSessionList();

  const ensureActiveSession = useCallback(async (): Promise<void> => {
    await ensureClerkActiveSession({
      isLoaded,
      isSignedIn,
      sessionId,
      sessionsLoaded,
      sessions,
      getToken,
      setActive,
    });
  }, [
    isLoaded,
    isSignedIn,
    sessionId,
    sessionsLoaded,
    sessions,
    getToken,
    setActive,
  ]);

  useEffect(() => {
    void ensureActiveSession();
  }, [ensureActiveSession]);

  useEffect(() => {
    setClerkAuthRuntime({
      startSSOFlow,
      signOut,
      getToken,
      setActive,
      ensureActiveSession,
    });
    return () => {
      setClerkAuthRuntime(null);
    };
  }, [startSSOFlow, signOut, getToken, setActive, ensureActiveSession]);

  return null;
}
