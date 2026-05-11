/**
 * Identity context: `deviceId`, `accountId`, and replication `myId`.
 * `AuthProvider` supplies values at the composition root.
 */
import { createContext, useContext, type ReactNode } from 'react';

export type IdentityState = {
  deviceId: string;
  accountId: string | null;
  myId: string;
};

const FALLBACK_IDENTITY: IdentityState = {
  deviceId: '',
  accountId: null,
  myId: '',
};

const IdentityContext = createContext<IdentityState | null>(null);

export function IdentityProvider({
  value,
  children,
}: {
  value: IdentityState;
  children: ReactNode;
}): ReactNode {
  return (
    <IdentityContext.Provider value={value}>
      {children}
    </IdentityContext.Provider>
  );
}

export function useIdentity(): IdentityState {
  return useContext(IdentityContext) ?? FALLBACK_IDENTITY;
}

export function useMyId(): string {
  return useIdentity().myId;
}

export function useMyDeviceId(): string {
  return useIdentity().deviceId;
}

export function useMyAccountId(): string | null {
  return useIdentity().accountId;
}
