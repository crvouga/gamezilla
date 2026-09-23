import { Handles } from '@libs/test-ids';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Sounds } from '@pkgs/sounds';
import type { JSX } from 'solid-js';

import type { FriendshipStatus } from '../../shared/friendship/friends-types';
import {
  ConfirmDeletePills,
  SingleActionPill,
} from './friend-action-pill-buttons';
import type { FriendActionMutations } from './friend-action-types';

/** Pill feedback strings (loading / success / error faces). */
export type FriendActionLabels = {
  readonly unavailable: string;
  readonly unblocking: string;
  readonly unblocked: string;
  readonly unblockFailed: string;
  readonly cancelling: string;
  readonly cancelled: string;
  readonly cancelFailed: string;
  readonly friends: string;
  readonly sending: string;
  readonly sent: string;
  readonly sendFailed: string;
};

/**
 * `t` must come from `useLingui()` in this scope: the Lingui macro only
 * compiles tagged templates on its own binding, so a `t` threaded through as
 * a parameter renders ''. Getters keep the labels locale-reactive.
 */
export function useFriendActionLabels(): FriendActionLabels {
  const { t } = useLingui();
  return {
    get unavailable() {
      return t`Unavailable`;
    },
    get unblocking() {
      return t`Unblocking…`;
    },
    get unblocked() {
      return t`Unblocked`;
    },
    get unblockFailed() {
      return t`Couldn't unblock`;
    },
    get cancelling() {
      return t`Cancelling…`;
    },
    get cancelled() {
      return t`Cancelled`;
    },
    get cancelFailed() {
      return t`Couldn't cancel`;
    },
    get friends() {
      return t`Friends`;
    },
    get sending() {
      return t`Sending…`;
    },
    get sent() {
      return t`Sent`;
    },
    get sendFailed() {
      return t`Couldn't send`;
    },
  };
}
type WrapMutation = (fn: () => Promise<void>) => () => Promise<void>;

function noopOperation(): Promise<void> {
  return Promise.resolve();
}

function renderBlockedByThem(labels: FriendActionLabels): JSX.Element {
  return (
    <SingleActionPill
      operation={noopOperation}
      idle={labels.unavailable}
      loading={labels.unavailable}
      success={labels.unavailable}
      error={labels.unavailable}
      variant="outline"
      disabled
    />
  );
}

function renderBlockedByMe(
  wrap: WrapMutation,
  mutations: FriendActionMutations,
  labels: FriendActionLabels
): JSX.Element {
  return (
    <SingleActionPill
      operation={wrap(mutations.unblock)}
      idle={<Trans>Unblock</Trans>}
      loading={labels.unblocking}
      success={labels.unblocked}
      error={labels.unblockFailed}
    />
  );
}

function renderPendingIncoming(
  wrap: WrapMutation,
  mutations: FriendActionMutations,
  username: string | undefined
): JSX.Element {
  return (
    <ConfirmDeletePills
      onConfirm={wrap(mutations.confirmRequest)}
      onDelete={wrap(mutations.deleteRequest)}
      {...(username !== undefined && username.length > 0
        ? { confirmTestID: Handles.friendConfirm(username) }
        : {})}
    />
  );
}

function renderPendingOutgoing(
  wrap: WrapMutation,
  mutations: FriendActionMutations,
  labels: FriendActionLabels
): JSX.Element {
  return (
    <SingleActionPill
      operation={wrap(mutations.cancelRequest)}
      idle={<Trans>Requested</Trans>}
      loading={labels.cancelling}
      success={labels.cancelled}
      error={labels.cancelFailed}
      variant="outline"
    />
  );
}

function renderFriends(
  labels: FriendActionLabels,
  username: string | undefined
): JSX.Element {
  return (
    <SingleActionPill
      operation={noopOperation}
      idle={<Trans>Friends</Trans>}
      loading={labels.friends}
      success={labels.friends}
      error={labels.friends}
      variant="outline"
      disabled
      {...(username !== undefined && username.length > 0
        ? { testID: Handles.friendStatusFriends(username) }
        : {})}
    />
  );
}

function renderNone(
  wrap: WrapMutation,
  mutations: FriendActionMutations,
  labels: FriendActionLabels,
  username: string | undefined
): JSX.Element {
  return (
    <SingleActionPill
      operation={wrap(mutations.addFriend)}
      idle={<Trans>Add Friend</Trans>}
      loading={labels.sending}
      success={labels.sent}
      error={labels.sendFailed}
      sounds={{
        success: Sounds.social.friendRequestReceived,
        error: Sounds.feedback.error,
      }}
      {...(username !== undefined && username.length > 0
        ? { testID: Handles.friendAdd(username) }
        : {})}
    />
  );
}

export function renderFriendActionPillsForStatus({
  status,
  mutations,
  wrap,
  labels,
  username,
}: {
  status: FriendshipStatus;
  mutations: FriendActionMutations;
  wrap: WrapMutation;
  labels: FriendActionLabels;
  username?: string | undefined;
}): JSX.Element {
  switch (status) {
    case 'blocked_by_them':
      return renderBlockedByThem(labels);
    case 'blocked_by_me':
      return renderBlockedByMe(wrap, mutations, labels);
    case 'pending_incoming':
      return renderPendingIncoming(wrap, mutations, username);
    case 'pending_outgoing':
      return renderPendingOutgoing(wrap, mutations, labels);
    case 'friends':
      return renderFriends(labels, username);
    default:
      return renderNone(wrap, mutations, labels, username);
  }
}
