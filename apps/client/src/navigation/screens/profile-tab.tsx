import { ProfileFriendsActions } from '@libs/friends/root/client/profile-friends-actions';
import { ProfileFriendsStats } from '@libs/friends/root/client/profile-friends-stats';
import { ProfileScreen } from '@libs/profile/root/client/profile-screen';

export default function ProfileTab() {
  return (
    <ProfileScreen
      friendsStats={<ProfileFriendsStats />}
      friendsActions={<ProfileFriendsActions />}
      bottomInset={0}
    />
  );
}
