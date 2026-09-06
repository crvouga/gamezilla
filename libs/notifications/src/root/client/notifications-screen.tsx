import { Trans, useLingui } from '@lingui/react/macro';
import {
  BellIcon,
  Box,
  Button,
  CheckIcon,
  EmptyState,
  ScreenBase,
  useContentEdgePadding,
  useMutationButton,
} from '@pkgs/ui';
import { type ReactNode, useCallback } from 'react';
import { useNotificationsShell } from '../../public/notifications-provider-registry';
import { useNotifications } from '../../public/use-notifications';
import { useNotificationsActions } from '../../public/use-notifications-actions';
import type { NotificationFilter } from '../../shared/notifications/notification';
import { NotificationsFilterBar } from './notifications-filter-bar';
import { NotificationsList } from './notifications-list';

export type NotificationsScreenProps = {
  readonly initialFilter?: NotificationFilter;
};

function NotificationsSignedInGate({
  children,
}: {
  readonly children: ReactNode;
}): ReactNode {
  const { t } = useLingui();
  const { isSignedIn, onSignIn } = useNotificationsShell();
  const edge = useContentEdgePadding();
  const px = edge?.horizontalStep ?? 0;
  if (isSignedIn) return children;
  return (
    <Box sx={px !== 0 ? { px } : undefined}>
      <EmptyState
        variant="compact"
        icon={BellIcon}
        title={<Trans>Sign in to see notifications</Trans>}
        body={<Trans>Friend requests and space invites will land here.</Trans>}
        {...(onSignIn !== undefined
          ? { action: { label: t`Sign in`, onPress: onSignIn } }
          : {})}
      />
    </Box>
  );
}

function NotificationsScreenBody({
  initialFilter,
}: {
  readonly initialFilter?: NotificationFilter;
}): ReactNode {
  const { t } = useLingui();
  const inboxOptions =
    initialFilter !== undefined ? { filter: initialFilter } : {};
  const { interactions, sections, isLoading, filter, setFilter } =
    useNotifications(inboxOptions);
  const inboxActions = useNotificationsActions();
  const edge = useContentEdgePadding();
  const px = edge?.horizontalStep ?? 0;
  const markAllRead = useMutationButton({
    operation: useCallback(async () => {
      await inboxActions.markAllRead();
    }, [inboxActions]),
    labels: {
      idle: t`Mark all read`,
      loading: t`Marking…`,
      success: t`Marked read`,
      error: t`Failed`,
    },
    successHoldMs: 0,
  });

  const hasUnread = interactions.some((item) => item.isUnread);

  return (
    <Box sx={{ flex: 1, minHeight: 0, gap: 2 }}>
      <Box
        sx={[
          px !== 0 ? { px } : false,
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 3,
          },
        ]}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <NotificationsFilterBar filter={filter} onFilterChange={setFilter} />
        </Box>
        {hasUnread ? (
          <Button
            variant="ghost"
            intent="neutral"
            size="sm"
            startIcon={<CheckIcon size={16} />}
            {...markAllRead.buttonProps}
          />
        ) : null}
      </Box>
      <NotificationsList
        sections={sections}
        isLoading={isLoading}
        filter={filter}
        actions={inboxActions}
      />
    </Box>
  );
}

function NotificationsBleedBody({
  sx,
  initialFilter,
}: {
  readonly sx: { flex?: 1; minHeight?: 0 };
  readonly initialFilter?: NotificationFilter;
}): ReactNode {
  const edge = useContentEdgePadding();
  const h = edge?.horizontalStep ?? 0;
  const b = edge?.bottomStep ?? 0;
  return (
    <Box
      sx={[
        sx,
        h !== 0 || b !== 0
          ? {
              ...(h !== 0
                ? {
                    mx: -h,
                    mt: -h,
                    pt: h,
                  }
                : {}),
              ...(b !== 0 ? { mb: -b, pb: b } : {}),
            }
          : false,
      ]}
    >
      <NotificationsSignedInGate>
        <NotificationsScreenBody
          {...(initialFilter !== undefined ? { initialFilter } : {})}
        />
      </NotificationsSignedInGate>
    </Box>
  );
}

export function NotificationsScreen({
  initialFilter,
}: NotificationsScreenProps): ReactNode {
  const { t } = useLingui();

  return (
    <ScreenBase
      screenId="notifications"
      breadcrumbs={[{ name: t`Notifications` }]}
      content={({ sx }) => (
        <NotificationsBleedBody
          sx={sx}
          {...(initialFilter !== undefined ? { initialFilter } : {})}
        />
      )}
    />
  );
}
