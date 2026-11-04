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
import { ScreenBodyVirtualList } from '@pkgs/ui-root-client-ts/screen-body-virtual-list';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import type { JSX } from 'solid-js';
import { Match, Show, Switch } from 'solid-js';
import { FriendUserRow } from './friend-user-row';

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
  /** Trailing content per row, such as a live-space badge. */
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

/** "Friends since March 2026", or nothing when the date is unknown. */
function FriendsSince(props: { readonly since: string }): JSX.Element {
  const { t, i18n } = useLingui();
  const label = (): string | null => {
    const ms = Date.parse(props.since);
    if (!Number.isFinite(ms)) return null;
    const month = new Intl.DateTimeFormat(i18n().locale, {
      month: 'long',
      year: 'numeric',
    }).format(new Date(ms));
    return t`Friends since ${month}`;
  };
  return <>{label()}</>;
}

/** One friend in the list's panel: face, name, since when, and the way in. */
function FriendsListRow(props: {
  readonly friend: Friend;
  readonly trailing: JSX.Element | undefined;
  readonly onOpen: () => void;
}): JSX.Element {
  return (
    <StackVertical paddingX="lg" paddingY="xs">
      <FriendUserRow
        profile={props.friend}
        caption={<FriendsSince since={props.friend.friendsSince} />}
        onPress={() => props.onOpen()}
        friendsListHandle
        disclosure
        trailing={props.trailing}
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
 * `/profile/friends`, presentational: the accepted friends list with its
 * loading, failed, empty and permission-denied states. Data and navigation
 * arrive as props; `FriendsListScreen` wires them to the sync engine.
 */
export function FriendsListScreenView(
  props: FriendsListScreenViewProps
): JSX.Element {
  return (
    <Show
      when={props.denial}
      fallback={
        <CollectionScreen
          screenId="friends-list"
          breadcrumbs={BREADCRUMBS()}
          controls={props.notice}
        >
          <ScreenBodyVirtualList
            items={props.friends}
            keyExtractor={(item) => item.userId}
            estimateSize={76}
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
