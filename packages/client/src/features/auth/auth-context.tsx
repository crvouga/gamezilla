import { createContext, useContext, type ReactNode } from 'react';

export type AuthState = {
  mode: 'guest' | 'signed-in';
  displayName: string;
};

const defaultState: AuthState = {
  mode: 'guest',
  displayName: 'Guest',
};

const AuthContext = createContext<AuthState>(defaultState);

export function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <AuthContext.Provider value={defaultState}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
