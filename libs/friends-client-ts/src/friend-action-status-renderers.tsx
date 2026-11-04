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
import { CheckIcon, UserPlusIcon } from '@pkgs/ui-root-client-ts/icons';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { type Accessor, type JSX, Show } from 'solid-js';
import {
  ConfirmDeletePills,
  SingleActionPill,
} from './friend-action-pill-buttons';

const STATUS_ICON_SIZE = 16;

type WrapMutation = (fn: () => Promise<void>) => () => Promise<void>;

/**
 * A relationship, not an action: words in the row's trailing slot (a check
 * and "Friends" in the success ink, "Unavailable" in the secondary ink),
 * never a pill. Actions are outlined pills, so the two never read alike,
 * and both end at the row's trailing edge, centred on it.
 */
function RelationshipStatus(props: {
  readonly label: JSX.Element;
  readonly intent: 'neutral' | 'success';
  readonly testId?: string | undefined;
}): JSX.Element {
  return (
    <StackHorizontal align="center" gap="xs" testId={props.testId}>
      <Show when={props.intent === 'success'}>
        <CheckIcon size={STATUS_ICON_SIZE} color="success" />
      </Show>
      <Text
        variant="label"
        tone={props.intent === 'success' ? 'success' : 'secondary'}
      >
        {props.label}
      </Text>
    </StackHorizontal>
  );
}

function renderBlockedByThem(): JSX.Element {
  return (
    <RelationshipStatus label={<Trans>Unavailable</Trans>} intent="neutral" />
  );
}

function renderBlockedByMe(
  wrap: WrapMutation,
  mutations: FriendActionMutations,
  username: string | undefined,
  compact: boolean
): JSX.Element {
  const { t } = useLingui();
  return (
    <SingleActionPill
      compact={compact}
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
  username: string | undefined,
  compact: boolean
): JSX.Element {
  return (
    <ConfirmDeletePills
      compact={compact}
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

/**
 * A request is out: one control that says so and what it does, "Cancel
 * request", never a tag with a second button beside it.
 */
function renderPendingOutgoing(
  wrap: WrapMutation,
  mutations: FriendActionMutations,
  username: string | undefined,
  compact: boolean
): JSX.Element {
  const { t } = useLingui();
  return (
    <SingleActionPill
      compact={compact}
      operation={wrap(mutations.cancelRequest)}
      idle={<Trans>Cancel request</Trans>}
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
  return (
    <RelationshipStatus
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
  row: { readonly username: string | undefined; readonly compact: boolean }
): JSX.Element {
  const { username, compact } = row;
  const { t } = useLingui();
  const sendFailureLabel = useSendFailureLabel();
  return (
    <StackVertical gap="xs">
      <SingleActionPill
        compact={compact}
        icon={UserPlusIcon}
        operation={wrap(mutations.addFriend)}
        idle={<Trans>Add friend</Trans>}
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

/**
 * The controls for one relationship. `compact` is a list row's trailing
 * control: one small secondary pill (or a tag), so every row ends alike.
 */
export function renderFriendActionPillsForStatus({
  status,
  mutations,
  addFailureCode,
  wrap,
  username,
  compact,
}: {
  status: FriendshipStatus;
  mutations: FriendActionMutations;
  addFailureCode: Accessor<string | null>;
  wrap: WrapMutation;
  username?: string | undefined;
  compact: boolean;
}): JSX.Element {
  switch (status) {
    case 'blocked_by_them':
      return renderBlockedByThem();
    case 'blocked_by_me':
      return renderBlockedByMe(wrap, mutations, username, compact);
    case 'pending_incoming':
      return renderPendingIncoming(wrap, mutations, username, compact);
    case 'pending_outgoing':
      return renderPendingOutgoing(wrap, mutations, username, compact);
    case 'friends':
      return renderFriends(username);
    default:
      return renderNone(wrap, mutations, addFailureCode, { username, compact });
  }
}
