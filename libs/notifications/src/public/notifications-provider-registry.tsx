/** @jsxImportSource solid-js */
import {
  type Accessor,
  createContext,
  createMemo,
  type JSX,
  useContext,
} from 'solid-js';

import type { NotificationProvider } from '../shared/notifications/notification-provider';
import type { NotificationsClientDeps } from './notifications-actions';

export type NotificationsShellContextValue = {
  readonly userId: string;
  readonly isSignedIn: boolean;
  /** Bearer + device headers are ready for notifications REST (may lag `isSignedIn`). */
  readonly isAuthReady: boolean;
  readonly deps: NotificationsClientDeps;
  readonly providers: readonly NotificationProvider[];
  readonly onSignIn?: (() => void) | undefined;
};

const NotificationsShellContext =
  createContext<NotificationsShellContextValue>();

export type NotificationsProviderRegistryProps = {
  readonly userId: string;
  readonly isSignedIn: boolean;
  readonly isAuthReady?: boolean | undefined;
  readonly deps: NotificationsClientDeps;
  readonly providers?: readonly NotificationProvider[] | undefined;
  readonly onSignIn?: (() => void) | undefined;
  readonly children: JSX.Element;
};

export function NotificationsProviderRegistry(
  props: NotificationsProviderRegistryProps
): JSX.Element {
  const value: NotificationsShellContextValue = {
    get userId() {
      return props.userId;
    },
    get isSignedIn() {
      return props.isSignedIn;
    },
    get isAuthReady() {
      return props.isAuthReady ?? props.isSignedIn;
    },
    get deps() {
      return props.deps;
    },
    get providers() {
      return props.providers ?? [];
    },
    get onSignIn() {
      return props.onSignIn;
    },
  };
  return (
    <NotificationsShellContext.Provider value={value}>
      {props.children}
    </NotificationsShellContext.Provider>
  );
}

export function useNotificationsShell(): NotificationsShellContextValue {
  const ctx = useContext(NotificationsShellContext);
  if (ctx === undefined) {
    throw new Error(
      'useNotificationsShell requires NotificationsProviderRegistry'
    );
  }
  return ctx;
}

export function useNotificationRenderProvider(
  namespace: Accessor<string>
): Accessor<NotificationProvider | undefined> {
  const shell = useNotificationsShell();
  return createMemo(() =>
    shell.providers.find((provider) => provider.id === namespace())
  );
}
