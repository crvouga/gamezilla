import type { FriendActionMutations } from '@libs/friends-shared-ts/friend-action-types';
import {
  FRIENDS_BLOCKED,
  FRIENDS_COOLDOWN,
  FRIENDS_REQUEST_EXISTS,
} from '@libs/friends-shared-ts/friends-mutation-codes';
import type { FriendshipStatus } from '@libs/friends-shared-ts/friends-types';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Sounds } from '@pkgs/sounds-shared-ts/sound-id';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { Accessor, JSX } from 'solid-js';
import {
  ConfirmDeletePills,
  SingleActionPill,
} from './friend-action-pill-buttons';

type WrapMutation = (fn: () => Promise<void>) => () => Promise<void>;

/** A relationship, not an action: a tag, never a button that does nothing. */
function RelationshipBadge(props: {
  readonly label: JSX.Element;
  readonly intent: 'neutral' | 'success';
  readonly testId?: string | undefined;
}): JSX.Element {
  // Its own box, so the tag centers on the row like a button would (a
  // badge keeps to the start of its parent's cross axis).
  return (
    <StackVertical>
      <Badge
        label={props.label}
        intent={props.intent}
        dataSet={
          props.testId === undefined ? undefined : { testid: props.testId }
        }
      />
    </StackVertical>
  );
}

function renderBlockedByThem(): JSX.Element {
  return (
    <RelationshipBadge label={<Trans>Unavailable</Trans>} intent="neutral" />
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

/** "Requested" as a tag, with the one real action beside it: Cancel. */
function renderPendingOutgoing(
  wrap: WrapMutation,
  mutations: FriendActionMutations,
  username: string | undefined
): JSX.Element {
  const { t } = useLingui();
  return (
    <StackHorizontal align="center" gap="sm">
      <RelationshipBadge label={<Trans>Requested</Trans>} intent="neutral" />
      <SingleActionPill
        operation={wrap(mutations.cancelRequest)}
        idle={<Trans>Cancel</Trans>}
        loading={t`Cancelling…`}
        success={t`Cancelled`}
        error={t`Couldn't cancel`}
        variant="ghost"
        {...(username !== undefined && username.length > 0
          ? { testID: Handles.friendCancel(username) }
          : {})}
      />
    </StackHorizontal>
  );
}

function renderFriends(username: string | undefined): JSX.Element {
  return (
    <RelationshipBadge
      label={<Trans>Friends</Trans>}
      intent="success"
      testId={
        username !== undefined && username.length > 0
          ? Handles.friendStatusFriends(username)
          : undefined
      }
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
    <StackVertical gap="xs">
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
    </StackVertical>
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
