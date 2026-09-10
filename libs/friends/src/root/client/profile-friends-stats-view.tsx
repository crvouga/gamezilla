import { Handles } from '@libs/test-ids';
import { Plural } from '@lingui/solid/macro';
import { ChevronRightIcon, useTheme } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { useFriends } from '../../use-cases/list-friends/client/use-friends';
import { FriendsProfileRoute } from './friends-profile-routes';
import { useFriendsProfileNavigation } from './use-friends-profile-chrome';

const CHEVRON_SIZE = 18;

export function ProfileFriendsStats(): JSX.Element {
  const navigate = useFriendsProfileNavigation();
  const theme = useTheme();
  const { friends } = useFriends();
  const count = friends.length;

  return (
    <button
      class="clickable clickableTint self-stretch flex-row items-center justify-between gap-3 py-1 rounded-[10px]"
      data-testid={Handles.profileFriendsStats}
      type="button"
      onClick={() => navigate(FriendsProfileRoute.Friends)}
    >
      <div class="box flex-row items-baseline gap-2">
        <h3 class="text textHeading">{String(count)}</h3>
        <p class="text text-text-secondary">
          {<Plural value={count} one="friend" other="friends" />}
        </p>
      </div>
      <ChevronRightIcon size={CHEVRON_SIZE} color={theme.colors.icon} />
    </button>
  );
}
