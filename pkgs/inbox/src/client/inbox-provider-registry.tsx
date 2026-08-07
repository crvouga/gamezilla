import { createContext, type ReactNode, useContext, useMemo } from 'react';

import type { InteractionProvider } from '../shared/interaction-provider';
import type { InboxClientDeps } from './inbox-actions';

export type InboxShellContextValue = {
  readonly userId: string;
  readonly isSignedIn: boolean;
  /** Bearer + device headers are ready for inbox REST (may lag `isSignedIn`). */
  readonly isAuthReady: boolean;
  readonly deps: InboxClientDeps;
  readonly providers: readonly InteractionProvider[];
  readonly onSignIn?: () => void;
};

const InboxShellContext = createContext<InboxShellContextValue | null>(null);

export type InboxProviderRegistryProps = {
  readonly userId: string;
  readonly isSignedIn: boolean;
  readonly isAuthReady?: boolean;
  readonly deps: InboxClientDeps;
  readonly providers?: readonly InteractionProvider[];
  readonly onSignIn?: () => void;
  readonly children: ReactNode;
};

export function InboxProviderRegistry({
  userId,
  isSignedIn,
  isAuthReady = isSignedIn,
  deps,
  providers = [],
  onSignIn,
  children,
}: InboxProviderRegistryProps): ReactNode {
  const value = useMemo((): InboxShellContextValue => {
    const base: InboxShellContextValue = {
      userId,
      isSignedIn,
      isAuthReady,
      deps,
      providers,
    };
    return onSignIn !== undefined ? { ...base, onSignIn } : base;
  }, [userId, isSignedIn, isAuthReady, deps, providers, onSignIn]);
  return (
    <InboxShellContext.Provider value={value}>
      {children}
    </InboxShellContext.Provider>
  );
}

export function useInboxShell(): InboxShellContextValue {
  const ctx = useContext(InboxShellContext);
  if (ctx === null) {
    throw new Error('useInboxShell requires InboxProviderRegistry');
  }
  return ctx;
}

export function useInteractionRenderProvider(
  namespace: string
): InteractionProvider | undefined {
  const { providers } = useInboxShell();
  return providers.find((provider) => provider.id === namespace);
}
