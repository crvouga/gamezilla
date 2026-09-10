import type { JSX } from 'solid-js';
import { FriendProfileAvatar } from '../../public/friend-profile-avatar';
import type { FriendProfile } from '../../shared/friendship/friends-types';

export type FriendProfileHeaderProps = {
  readonly profile: FriendProfile;
  readonly avatarSize?: number;
  readonly trailing?: JSX.Element;
};

export function FriendProfileHeader({
  profile,
  avatarSize = 96,
  trailing,
}: FriendProfileHeaderProps): JSX.Element {
  const handle =
    profile.username.length > 0
      ? `@${profile.username}`
      : profile.userId.slice(0, 8);

  return (
    <div class="box items-center gap-2 self-stretch">
      <FriendProfileAvatar profile={profile} size={avatarSize} />
      <div class="box items-center gap-1 self-stretch">
        <h1 class="text textTitle line-clamp-1 text-center">{handle}</h1>
      </div>
      {trailing}
    </div>
  );
}
