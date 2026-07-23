import { useAuth, useClerk, useSessionList, useSSO } from '@clerk/expo';
import { useCallback, useEffect } from 'react';

import { runCompleteHostedAuthRedirect } from './clerk-complete-hosted-auth-redirect';
import { ensureClerkActiveSession } from './clerk-ensure-active-session';
import type { ClerkSetActive } from './clerk-ensure-active-session';
import { setClerkAuthRuntime } from './clerk-auth-runtime';
import { mapClerkSessions } from './clerk-map-sessions';
import {
  startClerkAddAccountSsoFlow,
  startClerkBrowserSsoFlow,
} from './clerk-start-add-account-sso';

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

function useClerkEnsureActiveSession(args: {
  isLoaded: boolean;
  isSignedIn: boolean | undefined;
  sessionId: string | null | undefined;
  sessionsLoaded: boolean;
  sessions: ReturnType<typeof useSessionList>['sessions'];
  getToken: ReturnType<typeof useAuth>['getToken'];
  setActive: ClerkSetActive;
}): () => Promise<void> {
  const {
    isLoaded,
    isSignedIn,
    sessionId,
    sessionsLoaded,
    sessions,
    getToken,
    setActive,
  } = args;
  return useCallback(async (): Promise<void> => {
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
}

function useClerkSsoFlowStarters(clerk: ReturnType<typeof useClerk>): {
  startBrowserSSOFlow: (params: {
    readonly redirectUrl: string;
    readonly oidcPrompt?: string;
  }) => Promise<Awaited<ReturnType<typeof startClerkBrowserSsoFlow>>>;
  startAddAccountSSOFlow: (params: {
    readonly strategy: string;
    readonly redirectUrl: string;
  }) => Promise<Awaited<ReturnType<typeof startClerkAddAccountSsoFlow>>>;
} {
  const startBrowserSSOFlow = useCallback(
    async (params: {
      readonly redirectUrl: string;
      readonly oidcPrompt?: string;
    }) =>
      startClerkBrowserSsoFlow({
        clerk,
        redirectUrl: params.redirectUrl,
        ...(params.oidcPrompt !== undefined
          ? { oidcPrompt: params.oidcPrompt }
          : {}),
      }),
    [clerk]
  );

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

  return { startBrowserSSOFlow, startAddAccountSSOFlow };
}

export function ClerkAuthSync(): null {
  const clerk = useClerk();
  const { startSSOFlow } = useSSO();
  const { signOut, getToken, isLoaded, isSignedIn, sessionId } = useAuth();
  const setActive = useClerkSetActive();
  const { sessions, isLoaded: sessionsLoaded } = useSessionList();
  const ensureActiveSession = useClerkEnsureActiveSession({
    isLoaded,
    isSignedIn,
    sessionId,
    sessionsLoaded,
    sessions,
    getToken,
    setActive,
  });
  const { startBrowserSSOFlow, startAddAccountSSOFlow } =
    useClerkSsoFlowStarters(clerk);

  const completeHostedAuthRedirect = useCallback(
    () =>
      runCompleteHostedAuthRedirect({
        clerk,
        setActive,
        ensureActiveSession,
      }),
    [clerk, setActive, ensureActiveSession]
  );

  useEffect(() => {
    void ensureActiveSession();
  }, [ensureActiveSession]);

  useEffect(() => {
    const activeSessionId =
      typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : null;
    setClerkAuthRuntime({
      startSSOFlow,
      startBrowserSSOFlow,
      startAddAccountSSOFlow,
      completeHostedAuthRedirect,
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
    startBrowserSSOFlow,
    startAddAccountSSOFlow,
    completeHostedAuthRedirect,
    signOut,
    getToken,
    setActive,
    ensureActiveSession,
    sessionId,
    sessions,
  ]);

  return null;
}
