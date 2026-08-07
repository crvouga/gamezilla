import { useLingui } from '@lingui/react/macro';
import { openInbox, useInboxUnreadCount } from '@pkgs/inbox/client';
import {
  Badge,
  BellIcon,
  Box,
  Button,
  RegisterStatusBarItem,
  Text,
  useStatusBar,
  useTheme,
} from '@pkgs/ui';
import type { ReactNode } from 'react';

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

function NotificationsPanel({ unread }: { unread: number }): ReactNode {
  const { t } = useLingui();
  const { close } = useStatusBar();
  return (
    <Box sx={{ gap: 2 }}>
      <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
        {unread > 0 ? (
          <Badge
            label={unread > 99 ? '99+' : String(unread)}
            intent="destructive"
            tone="solid"
            size="sm"
          />
        ) : null}
        <Text
          variant="body"
          label={
            unread === 0
              ? t`No unread notifications`
              : unread === 1
                ? t`1 unread notification`
                : t`${unread} unread notifications`
          }
        />
      </Box>
      <Button
        title={t`Open inbox`}
        variant="outline"
        onPress={() => {
          close();
          openInbox();
        }}
      />
    </Box>
  );
}

/**
 * Registers inbox unread count into the global status bar.
 */
export function NotificationsStatusBarItem(): ReactNode {
  const { t } = useLingui();
  const unread = useInboxUnreadCount();
  const caption =
    unread === 0 ? t`None` : unread === 1 ? t`1 unread` : t`${unread} unread`;

  return (
    <RegisterStatusBarItem
      id="notifications"
      order={60}
      contentKey={unread}
      title={t`Notifications`}
      caption={caption}
      accessibilityLabel={caption}
      indicator={<NotificationsIndicator unread={unread} />}
      leading={<BellIcon size={18} />}
      panel={<NotificationsPanel unread={unread} />}
    />
  );
}
