import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@lingui/solid/macro';
import { AvatarGroup } from '@pkgs/ui-root-client-ts/avatar-group';
import { UsersIcon } from '@pkgs/ui-root-client-ts/icons';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { Text } from '@pkgs/ui-root-client-ts/text';
import { For, type JSX, Show } from 'solid-js';
import { FriendProfileAvatar } from './friend-profile-avatar';
import { FriendsProfileRoute } from './friends-profile-routes';
import { useFriends } from './use-friends';
import { useFriendsProfileNavigation } from './use-friends-profile-chrome';

const FACE_SIZE = 28;
const FACES_SHOWN = 4;

/**
 * How many friends, as the number the profile's identity shows beside the
 * name ("Friends 11"): the friends sub owns the count, the profile its
 * place.
 */
export function ProfileFriendsCount(): JSX.Element {
  // Keep the store object — destructuring `friends` snapshots the array once
  // in Solid and freezes the count at the first paint (often 0).
  const friendsState = useFriends();
  return (
    <Text variant="stat" numeral testId={Handles.profileFriendsCount}>
      {String(friendsState.friends().length)}
    </Text>
  );
}

/**
 * The friends panel's way to the list: their first few faces at its end,
 * so the row reads as people. The count itself is the identity's fact, so
 * the row never says it twice.
 */
export function ProfileFriendsStats(): JSX.Element {
  const navigate = useFriendsProfileNavigation();
  const friendsState = useFriends();

  // A bare row: the profile groups it with Find friends in one panel.
  return (
    <MenuRow
      leading={<UsersIcon size={20} color="icon" />}
      title={<Trans>All friends</Trans>}
      value={
        <Show when={friendsState.friends().length > 0}>
          <AvatarGroup
            size={FACE_SIZE}
            maxVisible={FACES_SHOWN}
            ringColor="surface"
          >
            <For each={friendsState.friends()}>
              {(friend) => (
                <FriendProfileAvatar profile={friend} size={FACE_SIZE} />
              )}
            </For>
          </AvatarGroup>
        </Show>
      }
      onClick={() => navigate(FriendsProfileRoute.Friends)}
      dataSet={{ testid: Handles.profileFriendsStats }}
    />
  );
}
