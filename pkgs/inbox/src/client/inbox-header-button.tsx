import { useLingui } from '@lingui/react/macro';
import type { IconProps } from '@pkgs/ui';
import { Badge, BellIcon, Box, IconButton, useRouter } from '@pkgs/ui';
import { type ReactNode, useCallback } from 'react';

import { inboxPath } from './inbox-routes';
import { useInboxUnreadCount } from './use-inbox-unread-count';

type InboxTabIconProps = IconProps & {
  readonly color: string;
};

export function InboxTabIcon({
  color,
  size = 24,
}: InboxTabIconProps): ReactNode {
  const unreadCount = useInboxUnreadCount();
  return (
    <Box sx={{ position: 'relative' }}>
      <BellIcon color={color} size={size} />
      {unreadCount > 0 ? (
        <Box sx={{ position: 'absolute', top: -4, right: -8 }}>
          <Badge
            label={unreadCount > 99 ? '99+' : String(unreadCount)}
            intent="destructive"
            size="sm"
          />
        </Box>
      ) : null}
    </Box>
  );
}

export function InboxHeaderButton(): ReactNode {
  const { t } = useLingui();
  const router = useRouter();
  const unreadCount = useInboxUnreadCount();
  const onPress = useCallback(() => {
    router.push(inboxPath());
  }, [router]);

  return (
    <Box sx={{ position: 'relative' }}>
      <IconButton
        accessibilityLabel={t`Inbox`}
        label={t`Inbox`}
        onPress={onPress}
      >
        <BellIcon size={20} />
      </IconButton>
      {unreadCount > 0 ? (
        <Box sx={{ position: 'absolute', top: -2, right: -2 }}>
          <Badge
            label={unreadCount > 99 ? '99+' : String(unreadCount)}
            intent="destructive"
            size="sm"
          />
        </Box>
      ) : null}
    </Box>
  );
}

export function InboxTabBadge(): ReactNode {
  const unreadCount = useInboxUnreadCount();
  if (unreadCount <= 0) return null;
  return (
    <Badge
      label={unreadCount > 99 ? '99+' : String(unreadCount)}
      intent="destructive"
      size="sm"
    />
  );
}
