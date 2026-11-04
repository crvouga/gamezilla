import type { Friend } from '@libs/friends-shared-ts/friends-types';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { CollectionScreen } from '@pkgs/ui-root-client-ts/collection-screen';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { UserPlusIcon } from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import type { ScreenBaseAction } from '@pkgs/ui-root-client-ts/screen-base-types';
import { ScreenBodyVirtualList } from '@pkgs/ui-root-client-ts/screen-body-virtual-list';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';
import { createMemo, Match, Show, Switch } from 'solid-js';
import { FriendRowDisclosure, FriendUserRow } from './friend-user-row';

/** Whether the friends list is still reading, could not load, or is known. */
export type FriendsListStatus = 'loading' | 'failed' | 'ready';

export type FriendsListScreenViewProps = {
  readonly status: FriendsListStatus;
  /** Accepted friends, in display order. Shown whenever non-empty. */
  readonly friends: readonly Friend[];
  /** Set when the person may not use friends; replaces the whole list. */
  readonly denial?: DenialView | undefined;
  /** Inline notice for a refused friend change, above the list. */
  readonly notice?: JSX.Element;
  /** What the friend is doing, under their name (hosting a space). */
  readonly friendStatus?: ((friend: Friend) => JSX.Element) | undefined;
  /**
   * The row's one control, such as Join for their live space. A row without
   * one ends in a chevron instead.
   */
  readonly friendTrailing?: ((friend: Friend) => JSX.Element) | undefined;
  readonly onOpenFriend: (friend: Friend) => void;
  readonly onFindFriends: () => void;
  readonly onRetry: () => void;
};

const BREADCRUMBS = () => [
  { name: <Trans>Profile</Trans>, href: '/profile' },
  { name: <Trans>Friends</Trans> },
];

function FriendsEmptyState(props: { onFindFriends: () => void }): JSX.Element {
  const { t } = useLingui();
  return (
    <EmptyState
      icon={UserPlusIcon}
      title={<Trans>No friends yet</Trans>}
      body={
        <Trans>Search for people by username to send a friend request.</Trans>
      }
      action={{ label: t`Find friends`, onClick: () => props.onFindFriends() }}
      dataSet={{ testid: Handles.friendsEmpty }}
    />
  );
}

/** A friends-list row's face: a bare name sits beside it without empty room. */
const ROW_AVATAR_SIZE = 40;
/** A row: the face and the row's vertical padding. */
const ROW_ESTIMATE = 56;

/**
 * One friend in the list's panel, a compact row: face and name, and what
 * they are doing while they are in a live space ("Hosting a space", under
 * the name). The row opens their profile. Its end holds one thing: Join
 * while they are in a live space (what helps you play now), otherwise the
 * chevron that says the row opens them — never a button and a chevron
 * side by side. How long you have been friends is record-keeping, not a
 * reason to tap, so the row leaves it out.
 */
function FriendsListRow(props: {
  readonly friend: Friend;
  readonly status: JSX.Element | undefined;
  readonly trailing: JSX.Element | undefined;
  readonly onOpen: () => void;
}): JSX.Element {
  return (
    <StackVertical paddingX="lg">
      <FriendUserRow
        profile={props.friend}
        onPress={() => props.onOpen()}
        friendsListHandle
        avatarSize={ROW_AVATAR_SIZE}
        subtitle={props.status}
        trailing={props.trailing ?? <FriendRowDisclosure />}
      />
    </StackVertical>
  );
}

/** What the list shows when it has no rows: still reading, cannot load, or none. */
function FriendsListPlaceholder(
  props: Pick<
    FriendsListScreenViewProps,
    'status' | 'onFindFriends' | 'onRetry'
  >
): JSX.Element {
  return (
    <Switch
      fallback={<FriendsEmptyState onFindFriends={props.onFindFriends} />}
    >
      <Match when={props.status === 'loading'}>
        <LoadingState />
      </Match>
      <Match when={props.status === 'failed'}>
        <ErrorState
          title={<Trans>Your friends could not be loaded</Trans>}
          body={<Trans>Check your connection and try again.</Trans>}
          retry={{ onClick: () => props.onRetry() }}
          dataSet={{ testid: 'friends-load-error' }}
        />
      </Match>
    </Switch>
  );
}

/**
 * Find friends in the header once the list has someone in it: the page's
 * next step stays in reach (the empty list offers it in its own place).
 */
function useFindFriendsAction(
  props: Pick<FriendsListScreenViewProps, 'friends' | 'onFindFriends'>
) {
  const { t } = useLingui();
  return createMemo((): readonly ScreenBaseAction[] =>
    props.friends.length > 0
      ? [
          {
            type: 'default',
            label: t`Find friends`,
            onClick: () => props.onFindFriends(),
            overflow: 'never',
          },
        ]
      : []
  );
}

/**
 * `/profile/friends`, presentational: the accepted friends list with Find
 * friends in the header, and its loading, failed, empty and
 * permission-denied states. Data and navigation arrive as props;
 * `FriendsListScreen` wires them to the sync engine.
 */
export function FriendsListScreenView(
  props: FriendsListScreenViewProps
): JSX.Element {
  const headerActions = useFindFriendsAction(props);
  return (
    <Show
      when={props.denial}
      fallback={
        <CollectionScreen
          screenId="friends-list"
          breadcrumbs={BREADCRUMBS()}
          actions={headerActions()}
          controls={props.notice}
        >
          <ScreenBodyVirtualList
            items={props.friends}
            keyExtractor={(item) => item.userId}
            estimateSize={ROW_ESTIMATE}
            empty={
              <FriendsListPlaceholder
                status={props.status}
                onFindFriends={props.onFindFriends}
                onRetry={props.onRetry}
              />
            }
            panel
            renderItem={(item) => (
              <FriendsListRow
                friend={item}
                status={props.friendStatus?.(item)}
                trailing={props.friendTrailing?.(item)}
                onOpen={() => props.onOpenFriend(item)}
              />
            )}
          />
        </CollectionScreen>
      }
    >
      {(denial) => (
        <ContentScreen
          screenId="friends-permission-gate"
          breadcrumbs={BREADCRUMBS()}
        >
          <DenialSurfaceView denial={denial()} />
        </ContentScreen>
      )}
    </Show>
  );
}
