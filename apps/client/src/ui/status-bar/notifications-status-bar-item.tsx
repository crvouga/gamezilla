import { useLingui } from '@lingui/react/macro';
import { inboxPath, useInboxUnreadCount } from '@pkgs/inbox/client';
import {
  BellIcon,
  Box,
  RegisterStatusBarItem,
  useRouter,
  useStatusBar,
  useTheme,
} from '@pkgs/ui';
import { type ReactNode, useCallback } from 'react';

function NotificationsIndicator({ unread }: { unread: number }): ReactNode {
  const theme = useTheme();
  return (
    <Box sx={{ position: 'relative' }}>
      <BellIcon size={12} color={theme.colors.textSecondary} />
      {unread > 0 ? (
        <Box
          sx={{
            position: 'absolute',
            top: -4,
            right: -6,
            width: 6,
            height: 6,
            borderRadius: 999,
            background: 'destructive',
          }}
        />
      ) : null}
    </Box>
  );
}

/**
 * Registers inbox unread count into the global status bar.
 */
export function NotificationsStatusBarItem(): ReactNode {
  const { t } = useLingui();
  const router = useRouter();
  const unread = useInboxUnreadCount();
  const { close } = useStatusBar();
  const caption =
    unread === 0 ? t`None` : unread === 1 ? t`1 unread` : t`${unread} unread`;
  const onPress = useCallback(() => {
    close();
    router.push(inboxPath());
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
