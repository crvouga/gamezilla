/** @jsxImportSource solid-js */
import { BadgedIcon } from '@pkgs/ui-root-client-ts/badged-icon';
import type { IconProps } from '@pkgs/ui-root-client-ts/create-icon';
import { BellIcon } from '@pkgs/ui-root-client-ts/icons';
import type { JSX } from 'solid-js';

import { useNotificationsUnreadCountChrome } from './notifications-unread-count-chrome';

/** `99+` past two digits; nothing when everything has been opened. */
function unreadBadge(count: number): string | undefined {
  if (count <= 0) return undefined;
  return count > 99 ? '99+' : String(count);
}

/**
 * Bell + unread badge; drop-in {@link IconComponent} for the notifications tab.
 * When unread, reserves trailing space so the badge does not cover a sibling
 * label in the wide header pill (`gap` alone is smaller than the badge).
 */
export function NotificationsTabIcon(props: IconProps): JSX.Element {
  const unreadCount = useNotificationsUnreadCountChrome();
  return (
    <BadgedIcon badge={unreadBadge(unreadCount())}>
      <BellIcon color={props.color} size={props.size ?? 24} />
    </BadgedIcon>
  );
}
