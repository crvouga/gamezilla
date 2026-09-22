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
  /** Bearer + device headers are ready for notifications REST (may lag permission). */
  readonly isAuthReady: boolean;
  readonly deps: NotificationsClientDeps;
  readonly providers: readonly NotificationProvider[];
};

const NotificationsShellContext =
  createContext<NotificationsShellContextValue>();

export type NotificationsProviderRegistryProps = {
  readonly userId: string;
  readonly isAuthReady?: boolean | undefined;
  readonly deps: NotificationsClientDeps;
  readonly providers?: readonly NotificationProvider[] | undefined;
  readonly children: JSX.Element;
};

export function NotificationsProviderRegistry(
  props: NotificationsProviderRegistryProps
): JSX.Element {
  const value: NotificationsShellContextValue = {
    get userId() {
      return props.userId;
    },
    get isAuthReady() {
      return props.isAuthReady ?? false;
    },
    get deps() {
      return props.deps;
    },
    get providers() {
      return props.providers ?? [];
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
