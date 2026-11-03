/** @jsxImportSource solid-js */

import type { NotificationFilter } from '@libs/notifications-shared-ts/notification';
import type { NotificationCardActions } from '@libs/notifications-shared-ts/notification-action';
import { InboxRefusal } from '@libs/notifications-shared-ts/notifications-actions';
import { DecisionGate } from '@libs/permissions-client-ts/decision-gate';
import { useUnlock } from '@libs/permissions-client-ts/unlock';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useSyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { BellIcon } from '@pkgs/ui-root-client-ts/icons';
import { createEffect, createSignal, type JSX, onMount } from 'solid-js';
import {
  type InboxChoiceFailure,
  inboxChoiceFailure,
} from './inbox-choice-failure';
import { NotificationCard } from './notification-card';
import { NotificationsScreenView } from './notifications-screen-view';
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
function UnlockOnArrival(props: {
  readonly decision: ReturnType<typeof useDecision>;
}): JSX.Element {
  const unlock = useUnlock();
  onMount(() => unlock.run(props.decision()));
  return null;
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

/** Mark all read, and the failure it or any choice last left. */
function useInboxChoices() {
  const sync = useSyncEngine();
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
  // Coming back online clears a "connection is missing" notice.
  let sawOffline = false;
  createEffect(() => {
    const isOnline = sync.status().online;
    if (!isOnline) {
      sawOffline = true;
      return;
    }
    if (sawOffline) {
      sawOffline = false;
      if (failure() === 'connection-missing') setFailure(null);
    }
  });
  return { actions, failure, marking, markAllRead };
}

function NotificationsInbox(props: {
  readonly initialFilter?: NotificationFilter | undefined;
}): JSX.Element {
  const inbox = useNotifications({
    get filter() {
      return props.initialFilter;
    },
  });
  const choices = useInboxChoices();
  return (
    <NotificationsScreenView
      sections={inbox.sections()}
      isLoading={inbox.isLoading()}
      filter={inbox.filter()}
      failure={choices.failure()}
      markingAllRead={choices.marking()}
      renderCard={(interaction) => (
        <NotificationCard interaction={interaction} actions={choices.actions} />
      )}
      onFilterChange={inbox.setFilter}
      onMarkAllRead={() => void choices.markAllRead()}
    />
  );
}

/** `/notifications`: wires `NotificationsScreenView` to permissions and the inbox. */
export function NotificationsScreen(
  props: NotificationsScreenProps
): JSX.Element {
  const decision = useDecision(PERMISSION.notificationsReceive);
  return (
    <DecisionGate
      decision={decision()}
      icon={BellIcon}
      denied={(denial) => (
        <>
          <UnlockOnArrival decision={decision} />
          <NotificationsScreenView
            sections={[]}
            isLoading={false}
            filter="all"
            failure={null}
            markingAllRead={false}
            denial={denial}
            renderCard={() => null}
            onFilterChange={() => undefined}
            onMarkAllRead={() => undefined}
          />
        </>
      )}
    >
      <NotificationsInbox initialFilter={props.initialFilter} />
    </DecisionGate>
  );
}
