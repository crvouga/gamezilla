/* eslint-disable lingui/no-unlocalized-strings -- Better Auth / Expo wiring (not user-facing copy). */
import { expoClient } from '@better-auth/expo/client';
import { createAuthClient } from 'better-auth/react';
import * as SecureStore from 'expo-secure-store';
import { getDefaultStore, useAtomValue } from 'jotai';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { configServiceAtom } from '../../runtime/atoms';
import { HostedAuthPortsProvider } from '../hosted-auth-ports-context';
import type { HostedAuthPorts } from '../ports';
import { HostedAuthUiBetterAuthAdapter } from './hosted-auth-ui-adapter';
import { HostedSessionBetterAuthAdapter } from './hosted-session-adapter';
import { HostedSignInBetterAuthAdapter } from './hosted-sign-in-adapter';
import { runHostedSessionSync } from './run-hosted-session-sync';

function authBaseUrl(apiUrl: string): string {
  const trimmed = apiUrl.trim();
  let origin =
    trimmed.length > 0 ? trimmed.replace(/\/$/, '') : 'http://127.0.0.1:8788';
  // Keep hosted auth on same-site host during local web dev to preserve
  // Better Auth state cookie across /sign-in -> /callback.
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    try {
      const u = new URL(origin);
      if (u.hostname === '127.0.0.1') {
        u.hostname = 'localhost';
        origin = u.origin;
      }
    } catch {
      /* keep origin when URL parsing fails */
    }
  }
  return `${origin}/api/auth`;
}

function InnerHostedAuth({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  const apiUrl = useAtomValue(configServiceAtom).getApiUrl();
  const baseURL = useMemo(() => authBaseUrl(apiUrl), [apiUrl]);

  const authClient = useMemo(
    () =>
      createAuthClient({
        baseURL,
        plugins: [
          expoClient({
            scheme: 'myapp',
            storagePrefix: 'gamezilla',
            storage: SecureStore,
          }),
        ],
      }),
    [baseURL]
  );

  const snapshot = authClient.useSession();
  const lastSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    const isLoaded = !snapshot.isPending;
    const computedSignedIn =
      isLoaded &&
      (snapshot.error === null || snapshot.error === undefined) &&
      snapshot.data !== null &&
      snapshot.data !== undefined;
    void runHostedSessionSync({
      store: getDefaultStore(),
      isLoaded,
      isSignedIn: computedSignedIn,
      getSessionToken: async () => {
        const r = await authClient.getSession();
        if (r.error !== null && r.error !== undefined) return null;
        if (r.data === null || r.data === undefined) return null;
        const record = r.data as { session?: { token?: string } };
        const tok = record.session?.token;
        return typeof tok === 'string' && tok.length > 0 ? tok : null;
      },
      lastSyncedRef,
    });
  }, [authClient, snapshot.data, snapshot.error, snapshot.isPending]);

  const ports = useMemo<HostedAuthPorts>(() => {
    const getSnapshot = () => ({
      isPending: snapshot.isPending,
      error: snapshot.error,
      data: snapshot.data,
    });
    return {
      session: new HostedSessionBetterAuthAdapter(authClient, getSnapshot),
      signIn: new HostedSignInBetterAuthAdapter(authClient),
      ui: new HostedAuthUiBetterAuthAdapter(),
    };
  }, [authClient, snapshot.data, snapshot.error, snapshot.isPending]);

  return (
    <HostedAuthPortsProvider value={ports}>{children}</HostedAuthPortsProvider>
  );
}

export function HostedAuthRuntime({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  return <InnerHostedAuth>{children}</InnerHostedAuth>;
}
