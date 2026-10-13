/** @jsxImportSource solid-js */

import type { NotificationFilter } from '@libs/notifications-shared/notification';
import type { NotificationCardActions } from '@libs/notifications-shared/notification-action';
import { InboxRefusal } from '@libs/notifications-shared/notifications-actions';
import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { useUnlock } from '@libs/permissions-client/unlock';
import { useDecision } from '@libs/permissions-client/use-can';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import {
  BellIcon,
  CheckCheckIcon,
  WifiOffIcon,
} from '@pkgs/ui-root-client/icons';
import { Notice } from '@pkgs/ui-root-client/notice';
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
/** A failed inbox choice says the connection is missing; success clears that. */
function reportingActions(
  raw: NotificationCardActions,
  report: (missing: boolean) => void
): NotificationCardActions {
  const settle = (run: () => Promise<void>): Promise<void> =>
    run().then(
      () => {
        report(false);
      },
      () => {
        report(true);
      }
    );
  // A refusal the server explained stays on the control. Calling it a
  // missing connection would close the choice and hide the reason.
  const performAction = (id: string, actionId: string): Promise<void> =>
    raw.performAction(id, actionId).then(
      () => {
        report(false);
      },
      (error: unknown) => {
        if (error instanceof InboxRefusal) throw error;
        report(true);
      }
    );
  return {
    markRead: (id) => settle(() => raw.markRead(id)),
    archive: (id) => settle(() => raw.archive(id)),
    performAction,
  };
}

function NotificationsScreenBody(props: {
  readonly initialFilter?: NotificationFilter | undefined;
  readonly onHeaderAction: (action: ScreenBaseAction | null) => void;
}): JSX.Element {
  const { t } = useLingui();
  const sync = useSyncEngine();
  const inbox = useNotifications({
    get filter() {
      return props.initialFilter;
    },
  });
  const rawActions = useNotificationsActions();
  const [missing, setMissing] = createSignal(false);
  const [marking, setMarking] = createSignal(false);
  const actions = reportingActions(rawActions, setMissing);
  const markAllRead = async (): Promise<void> => {
    setMarking(true);
    try {
      await rawActions.markAllRead();
      setMissing(false);
    } catch {
      setMissing(true);
    } finally {
      setMarking(false);
    }
  };
  const hasUnread = (): boolean =>
    inbox.interactions().some((item) => item.isUnread);

  let sawOffline = false;
  createEffect(() => {
    const online = sync.status().online;
    if (!online) {
      sawOffline = true;
      return;
    }
    if (sawOffline) {
      sawOffline = false;
      setMissing(false);
    }
  });
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
            dataSet: { testid: Handles.notificationsMarkAllRead },
          }
        : null
    );
  });
  onCleanup(() => props.onHeaderAction(null));

  return (
    <div class="box flex-1 min-h-0 gap-2">
      <Show when={missing()}>
        <Notice
          tone="error"
          icon={WifiOffIcon}
          dataSet={{ testid: Handles.notificationsConnectionMissing }}
        >
          <Trans>The connection is missing.</Trans>
        </Notice>
      </Show>
      <NotificationsFilterBar
        filter={inbox.filter()}
        onFilterChange={inbox.setFilter}
      />
      <NotificationsList
        sections={inbox.sections()}
        isLoading={inbox.isLoading()}
        filter={inbox.filter()}
        actions={actions}
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
