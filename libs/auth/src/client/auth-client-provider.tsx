import type { AuthClientPort } from '@pkgs/auth/client/auth-client-port';
import { createContext, type ReactNode, useContext } from 'react';

const AuthClientPortContext = createContext<AuthClientPort | null>(null);

export function AuthClientProvider({
  port,
  children,
}: {
  readonly port: AuthClientPort;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <AuthClientPortContext.Provider value={port}>
      {children}
    </AuthClientPortContext.Provider>
  );
}

export function useAuthClientPort(): AuthClientPort {
  const port = useContext(AuthClientPortContext);
  if (port === null) {
    throw new Error(
      'useAuthClientPort: AuthClientProvider missing — wrap with AppProviders'
    );
  }
  return port;
}
