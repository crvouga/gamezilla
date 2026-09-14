import { Handles } from '@libs/test-ids';
import type { useLingui } from '@lingui/solid/macro';
import { Trans } from '@lingui/solid/macro';
import { Sounds } from '@pkgs/sounds';
import type { JSX } from 'solid-js';

import type { FriendshipStatus } from '../../shared/friendship/friends-types';
import {
  ConfirmDeletePills,
  SingleActionPill,
} from './friend-action-pill-buttons';
import type { FriendActionMutations } from './friend-action-types';

type LinguiT = ReturnType<typeof useLingui>['t'];
type WrapMutation = (fn: () => Promise<void>) => () => Promise<void>;

function noopOperation(): Promise<void> {
  return Promise.resolve();
}

function renderBlockedByThem(t: LinguiT): JSX.Element {
  return (
    <SingleActionPill
      operation={noopOperation}
      idle={t`Unavailable`}
      loading={t`Unavailable`}
      success={t`Unavailable`}
      error={t`Unavailable`}
      variant="outline"
      disabled
    />
  );
}

function renderBlockedByMe(
  wrap: WrapMutation,
  mutations: FriendActionMutations,
  t: LinguiT
): JSX.Element {
  return (
    <SingleActionPill
      operation={wrap(mutations.unblock)}
      idle={<Trans>Unblock</Trans>}
      loading={t`Unblocking…`}
      success={t`Unblocked`}
      error={t`Couldn't unblock`}
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
  t: LinguiT
): JSX.Element {
  return (
    <SingleActionPill
      operation={wrap(mutations.cancelRequest)}
      idle={<Trans>Requested</Trans>}
      loading={t`Cancelling…`}
      success={t`Cancelled`}
      error={t`Couldn't cancel`}
      variant="outline"
    />
  );
}

function renderFriends(t: LinguiT, username: string | undefined): JSX.Element {
  return (
    <SingleActionPill
      operation={noopOperation}
      idle={<Trans>Friends</Trans>}
      loading={t`Friends`}
      success={t`Friends`}
      error={t`Friends`}
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
  t: LinguiT,
  username: string | undefined
): JSX.Element {
  return (
    <SingleActionPill
      operation={wrap(mutations.addFriend)}
      idle={<Trans>Add Friend</Trans>}
      loading={t`Sending…`}
      success={t`Sent`}
      error={t`Couldn't send`}
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
  t,
  username,
}: {
  status: FriendshipStatus;
  mutations: FriendActionMutations;
  wrap: WrapMutation;
  t: LinguiT;
  username?: string | undefined;
}): JSX.Element {
  switch (status) {
    case 'blocked_by_them':
      return renderBlockedByThem(t);
    case 'blocked_by_me':
      return renderBlockedByMe(wrap, mutations, t);
    case 'pending_incoming':
      return renderPendingIncoming(wrap, mutations, username);
    case 'pending_outgoing':
      return renderPendingOutgoing(wrap, mutations, t);
    case 'friends':
      return renderFriends(t, username);
    default:
      return renderNone(wrap, mutations, t, username);
  }
}
