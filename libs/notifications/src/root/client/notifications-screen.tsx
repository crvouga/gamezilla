/** @jsxImportSource solid-js */
import { Trans, useLingui } from '@lingui/solid/macro';
import {
  BellIcon,
  Box,
  Button,
  CheckIcon,
  EmptyState,
  ScreenBase,
  useMutationButton,
} from '@pkgs/ui';
import { type JSX, Show } from 'solid-js';
import { useNotificationsShell } from '../../public/notifications-provider-registry';
import { useNotifications } from '../../public/use-notifications';
import { useNotificationsActions } from '../../public/use-notifications-actions';
import type { NotificationFilter } from '../../shared/notifications/notification';
import { NotificationsFilterBar } from './notifications-filter-bar';
import { NotificationsList } from './notifications-list';

export type NotificationsScreenProps = {
  readonly initialFilter?: NotificationFilter | undefined;
};

function NotificationsSignedInGate(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const { t } = useLingui();
  const shell = useNotificationsShell();
  return (
    <Show
      when={shell.isSignedIn}
      fallback={
        <EmptyState
          variant="compact"
          icon={BellIcon}
          title={<Trans>Sign in to see notifications</Trans>}
          body={
            <Trans>Friend requests and space invites will land here.</Trans>
          }
          action={
            shell.onSignIn !== undefined
              ? { label: t`Sign in`, onClick: () => shell.onSignIn?.() }
              : undefined
          }
        />
      }
    >
      {props.children}
    </Show>
  );
}

function NotificationsScreenBody(props: {
  readonly initialFilter?: NotificationFilter | undefined;
}): JSX.Element {
  const { t } = useLingui();
  const inbox = useNotifications({
    get filter() {
      return props.initialFilter;
    },
  });
  const inboxActions = useNotificationsActions();
  const markAllRead = useMutationButton({
    operation: () => inboxActions.markAllRead(),
    labels: {
      get idle() {
        return t`Mark all read`;
      },
      get loading() {
        return t`Marking…`;
      },
      get success() {
        return t`Marked read`;
      },
      get error() {
        return t`Failed`;
      },
    },
    successHoldMs: 0,
  });

  const hasUnread = (): boolean =>
    inbox.interactions.some((item) => item.isUnread);

  return (
    <Box sx={{ flex: 1, minHeight: 0, gap: 2 }}>
      <Box
        sx={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 3,
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <NotificationsFilterBar
            filter={inbox.filter}
            onFilterChange={inbox.setFilter}
          />
        </Box>
        <Show when={hasUnread()}>
          <Button
            variant="ghost"
            intent="neutral"
            size="sm"
            startIcon={<CheckIcon size={16} />}
            {...markAllRead.buttonProps}
          />
        </Show>
      </Box>
      <NotificationsList
        sections={inbox.sections}
        isLoading={inbox.isLoading}
        filter={inbox.filter}
        actions={inboxActions}
      />
    </Box>
  );
}

export function NotificationsScreen(
  props: NotificationsScreenProps
): JSX.Element {
  const { t } = useLingui();

  return (
    <ScreenBase
      screenId="notifications"
      breadcrumbs={[{ name: t`Notifications` }]}
      content={(body) => (
        <Box sx={body.sx}>
          <NotificationsSignedInGate>
            <NotificationsScreenBody initialFilter={props.initialFilter} />
          </NotificationsSignedInGate>
        </Box>
      )}
    />
  );
}
