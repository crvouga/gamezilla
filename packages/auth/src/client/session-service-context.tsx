import { createContext, useContext, type ReactNode } from 'react';

import type { SessionService } from './session-service';

const SessionServiceContext = createContext<SessionService | null>(null);

export function useSessionService(): SessionService {
  const v = useContext(SessionServiceContext);
  if (v === null) {
    throw new Error(
      'useSessionService: missing provider — wrap the app with ClientDataPlaneProvider from @gamezilla/client'
    );
  }
  return v;
}

export function SessionServiceProvider({
  value,
  children,
}: {
  value: SessionService;
  children: ReactNode;
}): ReactNode {
  return (
    <SessionServiceContext.Provider value={value}>
      {children}
    </SessionServiceContext.Provider>
  );
}
