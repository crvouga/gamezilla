import { ProfileFriendsActions } from '@libs/friends/client/profile-friends-actions';
import { ProfileFriendsStats } from '@libs/friends/client/profile-friends-stats';
import { ProfileScreen } from '@libs/profile/client/profile-screen';

export default function ProfileTab() {
  return (
    <ProfileScreen
      friendsStats={<ProfileFriendsStats />}
      friendsActions={<ProfileFriendsActions />}
      bottomInset={0}
    />
  );
}
