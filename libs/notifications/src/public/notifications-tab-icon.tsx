/** @jsxImportSource solid-js */
import { Badge, BellIcon, type IconProps } from '@pkgs/ui';
import { type JSX, Show } from 'solid-js';

import { useNotificationsUnreadCount } from './use-notifications-unread-count';

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

/** Bell + unread badge; drop-in {@link IconComponent} for the notifications tab. */
export function NotificationsTabIcon(props: IconProps): JSX.Element {
  const unreadCount = useNotificationsUnreadCount();
  return (
    <div class="box relative">
      <BellIcon color={props.color} size={props.size ?? 24} />
      <Show when={unreadCount() > 0}>
        <div class="box absolute top-[-4px] right-[-8px]">
          <UnreadCountBadge count={unreadCount()} />
        </div>
      </Show>
    </div>
  );
}
