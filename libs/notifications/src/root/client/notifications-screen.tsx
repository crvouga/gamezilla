import { Trans, useLingui } from '@lingui/react/macro';
import {
  Box,
  Button,
  EmptyState,
  SCREEN_BODY_PADDING_STEP,
  ScreenBase,
  useMutationButton,
} from '@pkgs/ui';
import { type ReactNode, useCallback } from 'react';

import type { NotificationFilter } from '../shared/notification';
import { NotificationsFilterBar } from './notifications-filter-bar';
import { NotificationsList } from './notifications-list';
import { useNotificationsShell } from './notifications-provider-registry';
import { useNotifications } from './use-notifications';
import { useNotificationsActions } from './use-notifications-actions';

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
  if (isSignedIn) return children;
  return (
    <Box sx={{ px: SCREEN_BODY_PADDING_STEP }}>
      <EmptyState
        variant="compact"
        title={<Trans>Sign in to view your notifications</Trans>}
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

  return (
    <Box sx={{ gap: 3 }}>
      <Box sx={{ px: SCREEN_BODY_PADDING_STEP, gap: 2 }}>
        <NotificationsFilterBar filter={filter} onFilterChange={setFilter} />
        {interactions.some((item) => item.isUnread) ? (
          <Box sx={{ alignItems: 'flex-start' }}>
            <Button variant="ghost" size="sm" {...markAllRead.buttonProps} />
          </Box>
        ) : null}
      </Box>
      <NotificationsList
        sections={sections}
        isLoading={isLoading}
        actions={inboxActions}
      />
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
        <Box
          sx={[
            sx,
            {
              mx: -SCREEN_BODY_PADDING_STEP,
              mt: -SCREEN_BODY_PADDING_STEP,
              mb: -SCREEN_BODY_PADDING_STEP,
              pt: SCREEN_BODY_PADDING_STEP,
              pb: SCREEN_BODY_PADDING_STEP,
            },
          ]}
        >
          <NotificationsSignedInGate>
            <NotificationsScreenBody
              {...(initialFilter !== undefined ? { initialFilter } : {})}
            />
          </NotificationsSignedInGate>
        </Box>
      )}
    />
  );
}
