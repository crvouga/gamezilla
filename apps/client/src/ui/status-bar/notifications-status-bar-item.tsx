import {
  notificationsPath,
  useNotificationsUnreadCount,
} from '@libs/notifications/client';
import { useLingui } from '@lingui/react/macro';
import {
  Badge,
  BellIcon,
  RegisterStatusBarItem,
  useRouter,
  useStatusBar,
  useTheme,
} from '@pkgs/ui';
import { type ReactNode, useCallback } from 'react';

function NotificationsIndicator({
  unread,
}: {
  readonly unread: number;
}): ReactNode {
  const theme = useTheme();
  if (unread > 0) {
    return (
      <Badge
        label={unread > 99 ? '99+' : String(unread)}
        intent="brand"
        tone="solid"
        ping
        size="sm"
      />
    );
  }
  return <BellIcon size={12} color={theme.colors.textSecondary} />;
}

/**
 * Registers inbox unread count into the global status bar.
 */
export function NotificationsStatusBarItem(): ReactNode {
  const { t } = useLingui();
  const router = useRouter();
  const unread = useNotificationsUnreadCount();
  const { close } = useStatusBar();
  const caption =
    unread === 0 ? t`None` : unread === 1 ? t`1 unread` : t`${unread} unread`;
  const onPress = useCallback(() => {
    close();
    router.push(notificationsPath());
  }, [close, router]);

  return (
    <RegisterStatusBarItem
      id="notifications"
      order={60}
      contentKey={unread}
      title={t`Notifications`}
      caption={caption}
      accessibilityLabel={caption}
      active={unread > 0}
      indicator={<NotificationsIndicator unread={unread} />}
      leading={<BellIcon size={20} />}
      onPress={onPress}
    />
  );
}
