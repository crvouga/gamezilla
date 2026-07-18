import { useAuth, useClerk, useSessionList, useSSO } from '@clerk/expo';
import { useCallback, useEffect } from 'react';

import { ensureClerkActiveSession } from './clerk-ensure-active-session';
import type { ClerkSetActive } from './clerk-ensure-active-session';
import { setClerkAuthRuntime } from './clerk-auth-runtime';
import { mapClerkSessions } from './clerk-map-sessions';
import { startClerkAddAccountSsoFlow } from './clerk-start-add-account-sso';

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
  const clerk = useClerk();
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

  const startAddAccountSSOFlow = useCallback(
    async (params: {
      readonly strategy: string;
      readonly redirectUrl: string;
    }) =>
      startClerkAddAccountSsoFlow({
        clerk,
        strategy: params.strategy,
        redirectUrl: params.redirectUrl,
      }),
    [clerk]
  );

  useEffect(() => {
    void ensureActiveSession();
  }, [ensureActiveSession]);

  useEffect(() => {
    const activeSessionId =
      typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : null;
    setClerkAuthRuntime({
      startSSOFlow,
      startAddAccountSSOFlow,
      signOut,
      getToken,
      setActive,
      ensureActiveSession,
      getActiveSessionId: () => activeSessionId,
      listSessions: () => mapClerkSessions(clerk.client?.sessions ?? null),
    });
    return () => {
      setClerkAuthRuntime(null);
    };
  }, [
    clerk,
    startSSOFlow,
    startAddAccountSSOFlow,
    signOut,
    getToken,
    setActive,
    ensureActiveSession,
    sessionId,
    sessions,
  ]);

  return null;
}
