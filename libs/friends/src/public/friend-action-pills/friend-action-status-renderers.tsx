import { Handles } from '@libs/dst-handles';
import type { useLingui } from '@lingui/react/macro';
import { Trans } from '@lingui/react/macro';
import { Sounds } from '@pkgs/sounds';
import type { ReactNode } from 'react';

import type { FriendshipStatus } from '../../shared/friendship/friends-types';
import {
  ConfirmDeletePills,
  SingleActionPill,
} from './friend-action-pill-buttons';
import type { FriendActionMutations } from './friend-action-types';

type LinguiT = ReturnType<typeof useLingui>['t'];
type WrapMutation = (fn: () => Promise<void>) => () => Promise<void>;

function renderBlockedByThem(t: LinguiT): ReactNode {
  return (
    <SingleActionPill
      operation={async () => {}}
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
): ReactNode {
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
): ReactNode {
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
): ReactNode {
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

function renderFriends(t: LinguiT, username: string | undefined): ReactNode {
  return (
    <SingleActionPill
      operation={async () => {}}
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
): ReactNode {
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
}): ReactNode {
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
