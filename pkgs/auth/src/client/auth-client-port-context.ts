import type { ReactNode } from 'react';

import type { AuthClientPort } from './auth-client-port';

export type AuthClientPortContextValue = AuthClientPort | null;

export type AuthClientPortProviderProps = {
  readonly port: AuthClientPort;
  readonly children: ReactNode;
};
