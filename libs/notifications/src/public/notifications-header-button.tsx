/** @jsxImportSource solid-js */
import { useLingui } from '@lingui/solid/macro';
import {
  Badge,
  BellIcon,
  IconButton,
  type IconProps,
  useRouter,
} from '@pkgs/ui';
import { type JSX, Show } from 'solid-js';

import { notificationsPath } from './notifications-routes';
import { useNotificationsUnreadCount } from './use-notifications-unread-count';

type NotificationsTabIconProps = IconProps & {
  readonly color: string;
};

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

export function NotificationsTabIcon(
  props: NotificationsTabIconProps
): JSX.Element {
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

export function NotificationsHeaderButton(): JSX.Element {
  const { t } = useLingui();
  const router = useRouter();
  const unreadCount = useNotificationsUnreadCount();
  return (
    <div class="box relative">
      <IconButton
        label={t`Notifications`}
        onClick={() => router.push(notificationsPath())}
      >
        <BellIcon size={20} />
      </IconButton>
      <Show when={unreadCount() > 0}>
        <div class="box absolute top-[-2px] right-[-2px]">
          <UnreadCountBadge count={unreadCount()} />
        </div>
      </Show>
    </div>
  );
}

export function NotificationsTabBadge(): JSX.Element {
  const unreadCount = useNotificationsUnreadCount();
  return (
    <Show when={unreadCount() > 0}>
      <UnreadCountBadge count={unreadCount()} />
    </Show>
  );
}
