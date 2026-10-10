import { Handles } from '@libs/test-ids-shared/handles';
import { Plural } from '@lingui/solid/macro';
import { ChevronRightIcon } from '@pkgs/ui-root-client/icons';
import { useTheme } from '@pkgs/ui-root-client/theme-context';
import type { JSX } from 'solid-js';
import { FriendsProfileRoute } from './friends-profile-routes';
import { useFriends } from './use-friends';
import { useFriendsProfileNavigation } from './use-friends-profile-chrome';

const CHEVRON_SIZE = 20;

export function ProfileFriendsStats(): JSX.Element {
  const navigate = useFriendsProfileNavigation();
  const theme = useTheme();
  // Keep the store object — destructuring `friends` snapshots the array once
  // in Solid and freezes the count at the first paint (often 0).
  const friendsState = useFriends();

  return (
    <div class="panel self-stretch">
      <button
        class="clickable clickableTint flex-row items-center justify-between gap-3 px-4 py-3 min-h-14"
        data-testid={Handles.profileFriendsStats}
        type="button"
        onClick={() => navigate(FriendsProfileRoute.Friends)}
      >
        <div class="box flex-row items-baseline gap-2">
          <h3
            class="text textHeading textNumeral"
            data-testid={Handles.profileFriendsCount}
          >
            {String(friendsState.friends().length)}
          </h3>
          <p class="text textBody text-text-secondary">
            {
              <Plural
                value={friendsState.friends().length}
                one="friend"
                other="friends"
              />
            }
          </p>
        </div>
        <ChevronRightIcon size={CHEVRON_SIZE} color={theme.colors.icon} />
      </button>
    </div>
  );
}
