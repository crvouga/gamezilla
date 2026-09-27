import { Handles } from '@libs/test-ids';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Sounds } from '@pkgs/sounds';
import { type Accessor, type JSX, Show } from 'solid-js';

import {
  FRIENDS_BLOCKED,
  FRIENDS_COOLDOWN,
  FRIENDS_NEEDS_CONNECTION,
  FRIENDS_REQUEST_EXISTS,
} from '../../shared/friendship/friends-mutation-codes';
import type { FriendshipStatus } from '../../shared/friendship/friends-types';
import {
  ConfirmDeletePills,
  SingleActionPill,
} from './friend-action-pill-buttons';
import type { FriendActionMutations } from './friend-action-types';

type WrapMutation = (fn: () => Promise<void>) => () => Promise<void>;

function noopOperation(): Promise<void> {
  return Promise.resolve();
}

function renderBlockedByThem(): JSX.Element {
  const { t } = useLingui();
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
  username: string | undefined
): JSX.Element {
  const { t } = useLingui();
  return (
    <SingleActionPill
      operation={wrap(mutations.unblock)}
      idle={<Trans>Unblock</Trans>}
      loading={t`Unblocking…`}
      success={t`Unblocked`}
      error={t`Couldn't unblock`}
      {...(username !== undefined && username.length > 0
        ? { testID: Handles.friendUnblock(username) }
        : {})}
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
        ? {
            confirmTestID: Handles.friendConfirm(username),
            deleteTestID: Handles.friendDecline(username),
          }
        : {})}
    />
  );
}

function renderPendingOutgoing(
  wrap: WrapMutation,
  mutations: FriendActionMutations,
  username: string | undefined
): JSX.Element {
  const { t } = useLingui();
  return (
    <SingleActionPill
      operation={wrap(mutations.cancelRequest)}
      idle={<Trans>Requested</Trans>}
      loading={t`Cancelling…`}
      success={t`Cancelled`}
      error={t`Couldn't cancel`}
      variant="outline"
      {...(username !== undefined && username.length > 0
        ? { testID: Handles.friendCancel(username) }
        : {})}
    />
  );
}

function renderFriends(username: string | undefined): JSX.Element {
  const { t } = useLingui();
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

/**
 * The Add pill's error face: the reason the server refused, when it gave one.
 * Every renderer here takes `t` from its own `useLingui()`: the macro compiles
 * only that binding, and a `t` passed in as an argument renders labels empty.
 */
function useSendFailureLabel(): (code: string | null) => string {
  const { t } = useLingui();
  return (code) => {
    if (code === FRIENDS_COOLDOWN) return t`Try again later`;
    if (code === FRIENDS_BLOCKED) return t`Unavailable`;
    if (code === FRIENDS_REQUEST_EXISTS) return t`They already asked you`;
    if (code === FRIENDS_NEEDS_CONNECTION) return t`Needs a connection`;
    return t`Couldn't send`;
  };
}

function renderNone(
  wrap: WrapMutation,
  mutations: FriendActionMutations,
  addFailureCode: Accessor<string | null>,
  username: string | undefined
): JSX.Element {
  const { t } = useLingui();
  const sendFailureLabel = useSendFailureLabel();
  return (
    <div class="box gap-1">
      <SingleActionPill
        operation={wrap(mutations.addFriend)}
        idle={<Trans>Add Friend</Trans>}
        loading={t`Sending…`}
        success={t`Sent`}
        error={sendFailureLabel(addFailureCode())}
        sounds={{
          success: Sounds.social.friendRequestReceived,
          error: Sounds.feedback.error,
        }}
        {...(username !== undefined && username.length > 0
          ? { testID: Handles.friendAdd(username) }
          : {})}
      />
      {/* Offline, the request is not sent (nor kept for later): say why. */}
      <Show when={addFailureCode() === FRIENDS_NEEDS_CONNECTION}>
        <p
          class="text textCaption text-text-secondary"
          data-testid={Handles.friendRequestNeedsConnection}
        >
          <Trans>
            Friend requests need a connection. Try again once you're online.
          </Trans>
        </p>
      </Show>
    </div>
  );
}

export function renderFriendActionPillsForStatus({
  status,
  mutations,
  addFailureCode,
  wrap,
  username,
}: {
  status: FriendshipStatus;
  mutations: FriendActionMutations;
  addFailureCode: Accessor<string | null>;
  wrap: WrapMutation;
  username?: string | undefined;
}): JSX.Element {
  switch (status) {
    case 'blocked_by_them':
      return renderBlockedByThem();
    case 'blocked_by_me':
      return renderBlockedByMe(wrap, mutations, username);
    case 'pending_incoming':
      return renderPendingIncoming(wrap, mutations, username);
    case 'pending_outgoing':
      return renderPendingOutgoing(wrap, mutations, username);
    case 'friends':
      return renderFriends(username);
    default:
      return renderNone(wrap, mutations, addFailureCode, username);
  }
}
