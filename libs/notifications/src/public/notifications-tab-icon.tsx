/** @jsxImportSource solid-js */
import { Badge, BellIcon, type IconProps } from '@pkgs/ui';
import { type JSX, Show } from 'solid-js';

import { useNotificationsUnreadCountChrome } from './notifications-unread-count-chrome';

function UnreadCountBadge(props: { readonly count: number }): JSX.Element {
  return (
    <Badge
      label={props.count > 99 ? '99+' : String(props.count)}
      intent="brand"
      tone="solid"
      size="sm"
    />
  );
}

/**
 * Bell + unread badge; drop-in {@link IconComponent} for the notifications tab.
 * When unread, reserves trailing space so the badge does not cover a sibling
 * label in the wide header pill (`gap` alone is smaller than the badge).
 */
export function NotificationsTabIcon(props: IconProps): JSX.Element {
  const unreadCount = useNotificationsUnreadCountChrome();
  const hasUnread = (): boolean => unreadCount() > 0;
  return (
    <div class="box relative shrink-0" classList={{ 'pr-2.5': hasUnread() }}>
      <BellIcon color={props.color} size={props.size ?? 24} />
      <Show when={hasUnread()}>
        <div class="box absolute -top-1 right-0">
          <UnreadCountBadge count={unreadCount()} />
        </div>
      </Show>
    </div>
  );
}
