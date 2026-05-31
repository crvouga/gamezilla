/**
 * Single app-wide Better Auth client. `createAuthClient` must not be called
 * per hook — each instance owns a session atom that fetches `/get-session` on
 * subscribe, so duplicating clients multiplies cold-start traffic.
 */

import { createContext, useContext, useMemo, type ReactNode } from 'react';

import {
  authBaseUrl,
  createAppAuthClient,
  type AuthClient,
  type SessionSnapshot,
} from './better-auth-client';
import { useConfigService } from './config-service-context';

const AuthClientContext = createContext<AuthClient | null>(null);

export function AuthClientProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const apiUrl = useConfigService().getApiUrl();
  const baseURL = useMemo(() => authBaseUrl(apiUrl), [apiUrl]);
  const client = useMemo(() => createAppAuthClient(baseURL), [baseURL]);
  return (
    <AuthClientContext.Provider value={client}>
      {children}
    </AuthClientContext.Provider>
  );
}

export type { AuthClient, SessionSnapshot };

export function useAuthClient(): AuthClient {
  const client = useContext(AuthClientContext);
  if (client === null) {
    throw new Error(
      'useAuthClient: AuthClientProvider missing — wrap with AppProviders'
    );
  }
  return client;
}
