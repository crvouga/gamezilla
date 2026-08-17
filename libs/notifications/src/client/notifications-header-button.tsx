import { useLingui } from '@lingui/react/macro';
import type { IconProps } from '@pkgs/ui';
import { Badge, BellIcon, Box, IconButton, useRouter } from '@pkgs/ui';
import { type ReactNode, useCallback } from 'react';

import { notificationsPath } from './notifications-routes';
import { useNotificationsUnreadCount } from './use-notifications-unread-count';

type NotificationsTabIconProps = IconProps & {
  readonly color: string;
};

function UnreadCountBadge({ count }: { readonly count: number }): ReactNode {
  return (
    <Badge
      label={count > 99 ? '99+' : String(count)}
      intent="brand"
      tone="solid"
      ping
      size="sm"
    />
  );
}

export function NotificationsTabIcon({
  color,
  size = 24,
}: NotificationsTabIconProps): ReactNode {
  const unreadCount = useNotificationsUnreadCount();
  return (
    <Box sx={{ position: 'relative' }}>
      <BellIcon color={color} size={size} />
      {unreadCount > 0 ? (
        <Box sx={{ position: 'absolute', top: -4, right: -8 }}>
          <UnreadCountBadge count={unreadCount} />
        </Box>
      ) : null}
    </Box>
  );
}

export function NotificationsHeaderButton(): ReactNode {
  const { t } = useLingui();
  const router = useRouter();
  const unreadCount = useNotificationsUnreadCount();
  const onPress = useCallback(() => {
    router.push(notificationsPath());
  }, [router]);

  return (
    <Box sx={{ position: 'relative' }}>
      <IconButton
        accessibilityLabel={t`Notifications`}
        label={t`Notifications`}
        onPress={onPress}
      >
        <BellIcon size={20} />
      </IconButton>
      {unreadCount > 0 ? (
        <Box sx={{ position: 'absolute', top: -2, right: -2 }}>
          <UnreadCountBadge count={unreadCount} />
        </Box>
      ) : null}
    </Box>
  );
}

export function NotificationsTabBadge(): ReactNode {
  const unreadCount = useNotificationsUnreadCount();
  if (unreadCount <= 0) return null;
  return <UnreadCountBadge count={unreadCount} />;
}
