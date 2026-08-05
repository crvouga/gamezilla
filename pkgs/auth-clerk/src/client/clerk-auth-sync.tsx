import { useAuth, useClerk, useSessionList, useSSO } from '@clerk/expo';
import { useCallback, useEffect } from 'react';

import { runCompleteHostedAuthRedirect } from './clerk-complete-hosted-auth-redirect';
import { ensureClerkActiveSession } from './clerk-ensure-active-session';
import type { ClerkSetActive } from './clerk-ensure-active-session';
import {
  setClerkAuthRuntime,
  type ClerkStartBrowserSsoFlow,
} from './clerk-auth-runtime';
import { startClerkBrowserSsoFlow } from './clerk-start-browser-sso';

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

function usePublishClerkAuthRuntime(args: {
  clerk: ReturnType<typeof useClerk>;
  startSSOFlow: ReturnType<typeof useSSO>['startSSOFlow'];
  startBrowserSSOFlow: ClerkStartBrowserSsoFlow;
  completeHostedAuthRedirect: () => Promise<void>;
  signOut: ReturnType<typeof useAuth>['signOut'];
  getToken: ReturnType<typeof useAuth>['getToken'];
  setActive: ClerkSetActive;
  ensureActiveSession: () => Promise<void>;
  sessionId: string | null | undefined;
}): void {
  const {
    clerk,
    startSSOFlow,
    startBrowserSSOFlow,
    completeHostedAuthRedirect,
    signOut,
    getToken,
    setActive,
    ensureActiveSession,
    sessionId,
  } = args;
  useEffect(() => {
    const activeSessionId =
      typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : null;
    setClerkAuthRuntime({
      startSSOFlow,
      startBrowserSSOFlow,
      completeHostedAuthRedirect,
      signOut,
      getToken,
      setActive,
      ensureActiveSession,
      getActiveSessionId: () => activeSessionId,
    });
    return () => {
      setClerkAuthRuntime(null);
    };
  }, [
    clerk,
    startSSOFlow,
    startBrowserSSOFlow,
    completeHostedAuthRedirect,
    signOut,
    getToken,
    setActive,
    ensureActiveSession,
    sessionId,
  ]);
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

  usePublishClerkAuthRuntime({
    clerk,
    startSSOFlow,
    startBrowserSSOFlow,
    completeHostedAuthRedirect,
    signOut,
    getToken,
    setActive,
    ensureActiveSession,
    sessionId,
  });

  return null;
}
