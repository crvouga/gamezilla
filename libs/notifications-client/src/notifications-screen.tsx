/** @jsxImportSource solid-js */

import type { NotificationFilter } from '@libs/notifications-shared/notification';
import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { useUnlock } from '@libs/permissions-client/unlock';
import { useDecision } from '@libs/permissions-client/use-can';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-client/button';
import { BellIcon, CheckIcon } from '@pkgs/ui-client/icons';
import { ScreenBase } from '@pkgs/ui-client/screen-base';
import { useMutationButton } from '@pkgs/ui-client/use-mutation-button';
import { type JSX, onMount, Show } from 'solid-js';
import { NotificationsFilterBar } from './notifications-filter-bar';
import { NotificationsList } from './notifications-list';
import { useNotifications } from './use-notifications';
import { useNotificationsActions } from './use-notifications-actions';

export type NotificationsScreenProps = {
  readonly initialFilter?: NotificationFilter | undefined;
};

/**
 * Someone who may not have an inbox (a guest) is invited to unlock it the
 * moment they arrive — signing in, right there — with the denial surface
 * behind the invitation instead of an empty inbox.
 */
function NotificationsDenied(): JSX.Element {
  const decision = useDecision(PERMISSION.notificationsReceive);
  const unlock = useUnlock();
  onMount(() => unlock.run(decision()));
  return (
    <DenialSurface decision={decision()} icon={BellIcon} variant="compact" />
  );
}

function NotificationsPermissionGate(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const decision = useDecision(PERMISSION.notificationsReceive);
  return (
    <Show when={decision().allowed} fallback={<NotificationsDenied />}>
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
    <div class="box flex-1 min-h-0 gap-2">
      <div class="box flex-row items-center justify-between gap-3">
        <div class="box flex-1 min-w-0">
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
