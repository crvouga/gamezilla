import type { Friend } from '@libs/friends-shared/friends-types';
import { useFirstSyncError } from '@libs/profile-client/use-first-sync-error';
import { FriendLiveSpaceBadge } from '@libs/spaces-client/friend-live-space-badge';
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useSyncEngine } from '@pkgs/sync-engine-client/sync-engine-context';
import { useRouter } from '@pkgs/ui-root-client/app-router';
import { CollectionScreen } from '@pkgs/ui-root-client/collection-screen';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { ErrorState } from '@pkgs/ui-root-client/error-state';
import { UserPlusIcon } from '@pkgs/ui-root-client/icons';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { ScreenBodyVirtualList } from '@pkgs/ui-root-client/screen-body-virtual-list';
import { useBreadcrumbNav } from '@pkgs/ui-root-client/use-breadcrumb-nav';
import type { JSX } from 'solid-js';
import { Match, Switch } from 'solid-js';
import { FriendUserRow } from './friend-user-row';
import { FriendsPermissionGate } from './friends-permission-gate';
import { FriendsRefusedChangeNotice } from './friends-refused-change-notice';
import { useFriends } from './use-friends';

function FriendsEmptyState(): JSX.Element {
  const { t } = useLingui();
  const router = useRouter();
  return (
    <EmptyState
      icon={UserPlusIcon}
      title={<Trans>No friends yet</Trans>}
      body={
        <Trans>Search for people by username to send a friend request.</Trans>
      }
      action={{ label: t`Find friends`, onClick: () => router.push('/search') }}
      dataSet={{ testid: Handles.friendsEmpty }}
    />
  );
}

/** What the list shows when it has no rows: still reading, cannot load, or none. */
function FriendsListPlaceholder(props: { loading: boolean }): JSX.Element {
  const engine = useSyncEngine();
  const firstSyncError = useFirstSyncError();
  return (
    <Switch fallback={<FriendsEmptyState />}>
      <Match when={props.loading}>
        <LoadingState />
      </Match>
      <Match when={firstSyncError()}>
        <ErrorState
          title={<Trans>Your friends could not be loaded</Trans>}
          body={<Trans>Check your connection and try again.</Trans>}
          retry={{ onClick: () => void engine.refreshQueries() }}
          dataSet={{ testid: 'friends-load-error' }}
        />
      </Match>
    </Switch>
  );
}

function FriendsListBody(): JSX.Element {
  const router = useRouter();
  const nav = useBreadcrumbNav();
  const friendsState = useFriends();

  const openUser = (friend: Friend) => {
    router.push({
      pathname: '/profile/user/[userId]',
      params: {
        userId: friend.userId,
        username: friend.username,
        avatarConfig: friend.avatarConfig ?? '',
      },
    });
  };

  return (
    <CollectionScreen
      screenId="friends-list"
      breadcrumbs={[
        { name: <Trans>Profile</Trans>, onClick: nav('/profile') },
        { name: <Trans>Friends</Trans> },
      ]}
      controls={<FriendsRefusedChangeNotice />}
    >
      <ScreenBodyVirtualList
        items={friendsState.friends()}
        keyExtractor={(item) => item.userId}
        estimateSize={72}
        empty={<FriendsListPlaceholder loading={friendsState.isLoading()} />}
        renderItem={(item) => (
          <FriendUserRow
            profile={item}
            onPress={() => openUser(item)}
            friendsListHandle
            trailing={<FriendLiveSpaceBadge hostAccountId={item.userId} />}
          />
        )}
      />
    </CollectionScreen>
  );
}

export function FriendsListScreen(): JSX.Element {
  return (
    <FriendsPermissionGate>
      <FriendsListBody />
    </FriendsPermissionGate>
  );
}
