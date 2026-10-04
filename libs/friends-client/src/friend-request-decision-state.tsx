/** @jsxImportSource solid-js */

import type { Notification } from '@libs/notifications-shared/notification';
import type { NotificationCardActions } from '@libs/notifications-shared/notification-action';
import {
  createContext,
  createMemo,
  createSignal,
  type JSX,
  Show,
  useContext,
} from 'solid-js';
import { FriendRequestDecisionModal } from './friend-request-decision-modal';

/**
 * Which friend-request decision modal is open (by notification id), held
 * above the virtualized notification rows. Row content remounts whenever its
 * data object identity changes (read-state flips, sync merges) — modal open
 * state kept in the row would die with it, closing the modal from under the
 * user right after they open it.
 */
export type FriendRequestDecision = {
  readonly openId: () => string | null;
  readonly open: (
    interaction: Notification,
    actions: NotificationCardActions
  ) => void;
  readonly close: () => void;
};

const FriendRequestDecisionContext =
  createContext<FriendRequestDecision | null>(null);

export function FriendRequestDecisionProvider(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const [shown, setShown] = createSignal<{
    interaction: Notification;
    actions: NotificationCardActions;
  } | null>(null);
  const openId = createMemo(() => shown()?.interaction.id ?? null);
  const value: FriendRequestDecision = {
    openId,
    open: (interaction, actions) => setShown({ interaction, actions }),
    close: () => setShown(null),
  };
  return (
    <FriendRequestDecisionContext.Provider value={value}>
      {props.children}
      <Show when={shown()} keyed>
        {(snapshot) => (
          <FriendRequestDecisionModal
            visible
            interaction={snapshot.interaction}
            actions={snapshot.actions}
            onClose={value.close}
          />
        )}
      </Show>
    </FriendRequestDecisionContext.Provider>
  );
}

/** Null outside a provider (hosts that render cards standalone). */
export function useFriendRequestDecisionOptional(): FriendRequestDecision | null {
  return useContext(FriendRequestDecisionContext);
}
