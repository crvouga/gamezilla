import { AppHeaderInboxAndAccount } from '@apps/client/ui/app-header/app-header-inbox-and-account';
import { AppHeaderLogo } from '@apps/client/ui/app-header/app-header-logo';
import { AppHeaderTabs } from '@apps/client/ui/app-header/app-header-tabs';
import { useAccountActions } from '@apps/client/ui/use-account-actions';
import { ProfileFriendsActions } from '@libs/friends/client/profile-friends-actions';
import { ProfileFriendsStats } from '@libs/friends/client/profile-friends-stats';
import { ProfileScreen } from '@libs/profile/client/profile-screen';

export default function ProfileTab() {
  const accountActions = useAccountActions();
  return (
    <ProfileScreen
      accountActions={accountActions}
      leading={<AppHeaderLogo />}
      centerTabs={<AppHeaderTabs />}
      headerEnd={<AppHeaderInboxAndAccount />}
      friendsStats={<ProfileFriendsStats />}
      friendsActions={<ProfileFriendsActions />}
      bottomInset={0}
    />
  );
}
