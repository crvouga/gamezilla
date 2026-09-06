/** @jsxImportSource solid-js */
import { useLingui } from '@lingui/solid/macro';
import {
  Badge,
  BellIcon,
  Box,
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
    <Box sx={{ position: 'relative' }}>
      <BellIcon color={props.color} size={props.size ?? 24} />
      <Show when={unreadCount() > 0}>
        <Box sx={{ position: 'absolute', top: -4, right: -8 }}>
          <UnreadCountBadge count={unreadCount()} />
        </Box>
      </Show>
    </Box>
  );
}

export function NotificationsHeaderButton(): JSX.Element {
  const { t } = useLingui();
  const router = useRouter();
  const unreadCount = useNotificationsUnreadCount();
  return (
    <Box sx={{ position: 'relative' }}>
      <IconButton
        label={t`Notifications`}
        onClick={() => router.push(notificationsPath())}
      >
        <BellIcon size={20} />
      </IconButton>
      <Show when={unreadCount() > 0}>
        <Box sx={{ position: 'absolute', top: -2, right: -2 }}>
          <UnreadCountBadge count={unreadCount()} />
        </Box>
      </Show>
    </Box>
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
