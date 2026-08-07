import { AppAccountMenu } from '@apps/client/ui/app-header/app-account-menu';
import { AppHeaderLogo } from '@apps/client/ui/app-header/app-header-logo';
import { ProfileFriendsActions } from '@libs/friends/client/profile-friends-actions';
import { ProfileFriendsStats } from '@libs/friends/client/profile-friends-stats';
import { ProfileScreen } from '@libs/profile/client/profile-screen';

export default function ProfileTab() {
  return (
    <ProfileScreen
      accountMenu={<AppAccountMenu />}
      leading={<AppHeaderLogo />}
      friendsStats={<ProfileFriendsStats />}
      friendsActions={<ProfileFriendsActions />}
      bottomInset={0}
    />
  );
}
