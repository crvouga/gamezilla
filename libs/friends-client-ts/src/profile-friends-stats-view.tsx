import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Plural } from '@lingui/solid/macro';
import { MenuList } from '@pkgs/ui-root-client-ts/menu-list';
import { MenuRow } from '@pkgs/ui-root-client-ts/menu-row';
import { Text } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { FriendsProfileRoute } from './friends-profile-routes';
import { useFriends } from './use-friends';
import { useFriendsProfileNavigation } from './use-friends-profile-chrome';

export function ProfileFriendsStats(): JSX.Element {
  const navigate = useFriendsProfileNavigation();
  // Keep the store object — destructuring `friends` snapshots the array once
  // in Solid and freezes the count at the first paint (often 0).
  const friendsState = useFriends();

  return (
    <MenuList>
      <MenuRow
        title={
          <>
            <Text
              variant="bodyBold"
              numeral
              testId={Handles.profileFriendsCount}
            >
              {String(friendsState.friends().length)}
            </Text>{' '}
            <Text tone="secondary">
              <Plural
                value={friendsState.friends().length}
                one="friend"
                other="friends"
              />
            </Text>
          </>
        }
        onClick={() => navigate(FriendsProfileRoute.Friends)}
        dataSet={{ testid: Handles.profileFriendsStats }}
      />
    </MenuList>
  );
}
