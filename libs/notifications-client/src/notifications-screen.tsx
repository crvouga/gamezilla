/** @jsxImportSource solid-js */

import type { NotificationFilter } from '@libs/notifications-shared/notification';
import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { useUnlock } from '@libs/permissions-client/unlock';
import { useDecision } from '@libs/permissions-client/use-can';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { useLingui } from '@lingui/solid/macro';
import { BellIcon, CheckCheckIcon } from '@pkgs/ui-root-client/icons';
import { ScreenBase } from '@pkgs/ui-root-client/screen-base';
import type { ScreenBaseAction } from '@pkgs/ui-root-client/screen-base-types';
import {
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';
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

/**
 * The inbox. Marking everything read is a screen action, so it is handed to
 * the header rather than squeezed beside the filters.
 */
function NotificationsScreenBody(props: {
  readonly initialFilter?: NotificationFilter | undefined;
  readonly onHeaderAction: (action: ScreenBaseAction | null) => void;
}): JSX.Element {
  const { t } = useLingui();
  const inbox = useNotifications({
    get filter() {
      return props.initialFilter;
    },
  });
  const inboxActions = useNotificationsActions();
  const [marking, setMarking] = createSignal(false);
  const markAllRead = async (): Promise<void> => {
    setMarking(true);
    try {
      await inboxActions.markAllRead();
    } finally {
      setMarking(false);
    }
  };
  const hasUnread = (): boolean =>
    inbox.interactions().some((item) => item.isUnread);

  createEffect(() => {
    props.onHeaderAction(
      hasUnread()
        ? {
            type: 'default',
            label: t`Mark all read`,
            icon: CheckCheckIcon,
            loading: marking(),
            onClick: () => {
              void markAllRead();
            },
            overflow: 'never',
            dataSet: { testid: 'notifications-mark-all-read' },
          }
        : null
    );
  });
  onCleanup(() => props.onHeaderAction(null));

  return (
    <div class="box flex-1 min-h-0 gap-2">
      <NotificationsFilterBar
        filter={inbox.filter()}
        onFilterChange={inbox.setFilter}
      />
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
  const [headerAction, setHeaderAction] = createSignal<ScreenBaseAction | null>(
    null
  );
  const actions = createMemo((): readonly ScreenBaseAction[] => {
    const action = headerAction();
    return action === null ? [] : [action];
  });

  return (
    <ScreenBase
      screenId="notifications"
      breadcrumbs={[{ name: t`Notifications` }]}
      actions={actions()}
      content={(body) => (
        <div class={`box ${body.bodyClass}`}>
          <NotificationsPermissionGate>
            <NotificationsScreenBody
              initialFilter={props.initialFilter}
              onHeaderAction={setHeaderAction}
            />
          </NotificationsPermissionGate>
        </div>
      )}
    />
  );
}
