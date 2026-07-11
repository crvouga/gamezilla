import { Trans } from '@lingui/react/macro';
import { Sounds } from '@pkgs/sounds';
import type { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import type { FriendMutations } from './friend-action-context';
import {
  ConfirmDeletePills,
  SingleActionPill,
} from './friend-action-pill-buttons';
import type { FriendshipStatus } from '../shared/friends-types';

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
  mutations: FriendMutations,
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
  mutations: FriendMutations
): ReactNode {
  return (
    <ConfirmDeletePills
      onConfirm={wrap(mutations.confirmRequest)}
      onDelete={wrap(mutations.deleteRequest)}
    />
  );
}

function renderPendingOutgoing(
  wrap: WrapMutation,
  mutations: FriendMutations,
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

function renderFriends(t: LinguiT): ReactNode {
  return (
    <SingleActionPill
      operation={async () => {}}
      idle={<Trans>Friends</Trans>}
      loading={t`Friends`}
      success={t`Friends`}
      error={t`Friends`}
      variant="outline"
      disabled
    />
  );
}

function renderNone(
  wrap: WrapMutation,
  mutations: FriendMutations,
  t: LinguiT
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
    />
  );
}

export function renderFriendActionPillsForStatus(
  status: FriendshipStatus,
  mutations: FriendMutations,
  wrap: WrapMutation,
  t: LinguiT
): ReactNode {
  switch (status) {
    case 'blocked_by_them':
      return renderBlockedByThem(t);
    case 'blocked_by_me':
      return renderBlockedByMe(wrap, mutations, t);
    case 'pending_incoming':
      return renderPendingIncoming(wrap, mutations);
    case 'pending_outgoing':
      return renderPendingOutgoing(wrap, mutations, t);
    case 'friends':
      return renderFriends(t);
    default:
      return renderNone(wrap, mutations, t);
  }
}
