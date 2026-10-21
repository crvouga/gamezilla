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
import { CollectionScreen } from '@pkgs/ui-root-client/collection-screen';
import {
  BellIcon,
  CheckCheckIcon,
  WifiOffIcon,
} from '@pkgs/ui-root-client/icons';
import { Notice } from '@pkgs/ui-root-client/notice';
import type { ScreenBaseAction } from '@pkgs/ui-root-client/screen-base-types';
import {
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  Match,
  onMount,
  Show,
  Switch,
} from 'solid-js';
import {
  type InboxChoiceFailure,
  inboxChoiceFailure,
} from './inbox-choice-failure';
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
  const { t } = useLingui();
  const decision = useDecision(PERMISSION.notificationsReceive);
  const unlock = useUnlock();
  onMount(() => unlock.run(decision()));
  return (
    <CollectionScreen
      screenId="notifications"
      breadcrumbs={[{ name: t`Notifications` }]}
    >
      <DenialSurface decision={decision()} icon={BellIcon} variant="compact" />
    </CollectionScreen>
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

/** A failed inbox choice says why by its outcome; success clears that. */
function reportingActions(
  raw: NotificationCardActions,
  report: (failure: InboxChoiceFailure | null) => void,
  online: () => boolean
): NotificationCardActions {
  const settle = (run: () => Promise<void>): Promise<void> =>
    run().then(
      () => {
        report(null);
      },
      (error: unknown) => {
        report(inboxChoiceFailure(error, online()));
      }
    );
  // A refusal the server explained stays on the control. Calling it a
  // missing connection would close the choice and hide the reason.
  const performAction = (id: string, actionId: string): Promise<void> =>
    raw.performAction(id, actionId).then(
      () => {
        report(null);
      },
      (error: unknown) => {
        if (error instanceof InboxRefusal) throw error;
        report(inboxChoiceFailure(error, online()));
      }
    );
  return {
    markRead: (id) => settle(() => raw.markRead(id)),
    archive: (id) => settle(() => raw.archive(id)),
    performAction,
  };
}

/** What the person is told when an inbox choice did not happen. */
function InboxChoiceFailureNotice(props: {
  readonly failure: InboxChoiceFailure;
}): JSX.Element {
  return (
    <Switch>
      <Match when={props.failure === 'connection-missing'}>
        <Notice
          tone="error"
          icon={WifiOffIcon}
          dataSet={{ testid: Handles.notificationsConnectionMissing }}
        >
          <Trans>The connection is missing.</Trans>
        </Notice>
      </Match>
      <Match when={props.failure === 'refused'}>
        <Notice
          tone="error"
          dataSet={{ testid: Handles.notificationsChoiceRefused }}
        >
          <Trans>
            That change wasn't made. The item may no longer be in your inbox.
          </Trans>
        </Notice>
      </Match>
      <Match when={props.failure === 'failed'}>
        <Notice
          tone="error"
          dataSet={{ testid: Handles.notificationsChoiceFailed }}
        >
          <Trans>That change wasn't made. Try again in a moment.</Trans>
        </Notice>
      </Match>
    </Switch>
  );
}

/**
 * The inbox. Marking everything read is a screen action, so it is handed to
 * the header rather than squeezed beside the filters.
 */
function NotificationsScreenBody(props: {
  readonly initialFilter?: NotificationFilter | undefined;
}): JSX.Element {
  const { t } = useLingui();
  const sync = useSyncEngine();
  const inbox = useNotifications({
    get filter() {
      return props.initialFilter;
    },
  });
  const rawActions = useNotificationsActions();
  const [failure, setFailure] = createSignal<InboxChoiceFailure | null>(null);
  const [marking, setMarking] = createSignal(false);
  const online = (): boolean => sync.getStatus().online;
  const actions = reportingActions(rawActions, setFailure, online);
  const markAllRead = async (): Promise<void> => {
    setMarking(true);
    try {
      await rawActions.markAllRead();
      setFailure(null);
    } catch (error: unknown) {
      setFailure(inboxChoiceFailure(error, online()));
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
      if (failure() === 'connection-missing') setFailure(null);
    }
  });
  const headerActions = createMemo((): readonly ScreenBaseAction[] =>
    hasUnread()
      ? [
          {
            type: 'default',
            label: t`Mark all read`,
            icon: CheckCheckIcon,
            loading: marking(),
            onClick: () => {
              void markAllRead();
            },
            overflow: 'never',
            dataSet: { testid: Handles.notificationsMarkAllRead },
          },
        ]
      : []
  );

  return (
    <CollectionScreen
      screenId="notifications"
      breadcrumbs={[{ name: t`Notifications` }]}
      actions={headerActions()}
      controls={
        <>
          <Show when={failure()} keyed>
            {(current) => <InboxChoiceFailureNotice failure={current} />}
          </Show>
          <NotificationsFilterBar
            filter={inbox.filter()}
            onFilterChange={inbox.setFilter}
          />
        </>
      }
    >
      <NotificationsList
        sections={inbox.sections()}
        isLoading={inbox.isLoading()}
        filter={inbox.filter()}
        actions={actions}
      />
    </CollectionScreen>
  );
}

export function NotificationsScreen(
  props: NotificationsScreenProps
): JSX.Element {
  return (
    <NotificationsPermissionGate>
      <NotificationsScreenBody initialFilter={props.initialFilter} />
    </NotificationsPermissionGate>
  );
}
