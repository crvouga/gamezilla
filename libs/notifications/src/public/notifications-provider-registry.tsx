import { createContext, type ReactNode, useContext, useMemo } from 'react';

import type { NotificationProvider } from '../shared/notification-provider';
import type { NotificationsClientDeps } from './notifications-actions';

export type NotificationsShellContextValue = {
  readonly userId: string;
  readonly isSignedIn: boolean;
  /** Bearer + device headers are ready for notifications REST (may lag `isSignedIn`). */
  readonly isAuthReady: boolean;
  readonly deps: NotificationsClientDeps;
  readonly providers: readonly NotificationProvider[];
  readonly onSignIn?: () => void;
};

const NotificationsShellContext =
  createContext<NotificationsShellContextValue | null>(null);

export type NotificationsProviderRegistryProps = {
  readonly userId: string;
  readonly isSignedIn: boolean;
  readonly isAuthReady?: boolean;
  readonly deps: NotificationsClientDeps;
  readonly providers?: readonly NotificationProvider[];
  readonly onSignIn?: () => void;
  readonly children: ReactNode;
};

export function NotificationsProviderRegistry({
  userId,
  isSignedIn,
  isAuthReady = isSignedIn,
  deps,
  providers = [],
  onSignIn,
  children,
}: NotificationsProviderRegistryProps): ReactNode {
  const value = useMemo((): NotificationsShellContextValue => {
    const base: NotificationsShellContextValue = {
      userId,
      isSignedIn,
      isAuthReady,
      deps,
      providers,
    };
    return onSignIn !== undefined ? { ...base, onSignIn } : base;
  }, [userId, isSignedIn, isAuthReady, deps, providers, onSignIn]);
  return (
    <NotificationsShellContext.Provider value={value}>
      {children}
    </NotificationsShellContext.Provider>
  );
}

export function useNotificationsShell(): NotificationsShellContextValue {
  const ctx = useContext(NotificationsShellContext);
  if (ctx === null) {
    throw new Error(
      'useNotificationsShell requires NotificationsProviderRegistry'
    );
  }
  return ctx;
}

export function useNotificationRenderProvider(
  namespace: string
): NotificationProvider | undefined {
  const { providers } = useNotificationsShell();
  return providers.find((provider) => provider.id === namespace);
}
