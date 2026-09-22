/** @jsxImportSource solid-js */
import { DenialSurface } from '@libs/permissions/public/denial-surface';
import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import { useDecision } from '@libs/permissions/public/use-can';
import { useLingui } from '@lingui/solid/macro';
import {
  BellIcon,
  Button,
  CheckIcon,
  ScreenBase,
  useMutationButton,
} from '@pkgs/ui';
import { type JSX, Show } from 'solid-js';
import { useNotifications } from '../../public/use-notifications';
import { useNotificationsActions } from '../../public/use-notifications-actions';
import type { NotificationFilter } from '../../shared/notifications/notification';
import { NotificationsFilterBar } from './notifications-filter-bar';
import { NotificationsList } from './notifications-list';

export type NotificationsScreenProps = {
  readonly initialFilter?: NotificationFilter | undefined;
};

function NotificationsPermissionGate(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const decision = useDecision(PERMISSION.notificationsReceive);
  return (
    <Show
      when={decision().allowed}
      fallback={
        <DenialSurface
          decision={decision()}
          icon={BellIcon}
          variant="compact"
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
    inbox.interactions().some((item) => item.isUnread);

  return (
    <div class="box flex-1 min-h-[0] gap-2">
      <div class="box flex-row items-center justify-between gap-3">
        <div class="box flex-1 min-w-[0]">
          <NotificationsFilterBar
            filter={inbox.filter()}
            onFilterChange={inbox.setFilter}
          />
        </div>
        <Show when={hasUnread()}>
          <Button
            variant="ghost"
            intent="neutral"
            size="sm"
            startIcon={<CheckIcon size={16} />}
            {...markAllRead.buttonProps}
          />
        </Show>
      </div>
      <NotificationsList
        sections={inbox.sections()}
        isLoading={inbox.isLoading()}
        filter={inbox.filter()}
        actions={inboxActions}
      />
    </div>
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
        <div class={`box ${body.bodyClass}`}>
          <NotificationsPermissionGate>
            <NotificationsScreenBody initialFilter={props.initialFilter} />
          </NotificationsPermissionGate>
        </div>
      )}
    />
  );
}
