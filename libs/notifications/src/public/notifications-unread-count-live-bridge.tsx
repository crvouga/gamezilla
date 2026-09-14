/** @jsxImportSource solid-js */
/**
 * Pushes the inbox unread query into {@link NotificationsUnreadCountRoot}.
 * Must run under `NotificationsProviderRegistry` + `SyncEngineProvider`.
 */

import { createEffect, type JSX, onCleanup } from 'solid-js';

import {
  BOOT_NOTIFICATIONS_UNREAD_COUNT,
  useNotificationsUnreadCountPublisher,
} from './notifications-unread-count-chrome';
import { useNotificationsUnreadCount } from './use-notifications-unread-count';

export function NotificationsUnreadCountLiveBridge(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const publish = useNotificationsUnreadCountPublisher();
  const unreadCount = useNotificationsUnreadCount();
  createEffect(() => {
    publish(unreadCount());
  });
  onCleanup(() => {
    publish(BOOT_NOTIFICATIONS_UNREAD_COUNT);
  });
  return <>{props.children}</>;
}
