import type { JSX } from 'solid-js';
import { FriendProfileAvatar } from '../../public/friend-profile-avatar';
import type { FriendProfile } from '../../shared/friendship/friends-types';

export type FriendProfileHeaderProps = {
  readonly profile: FriendProfile;
  readonly avatarSize?: number;
  readonly trailing?: JSX.Element;
};

export function FriendProfileHeader(
  props: FriendProfileHeaderProps
): JSX.Element {
  const handle = () =>
    props.profile.username.length > 0
      ? `@${props.profile.username}`
      : props.profile.userId.slice(0, 8);

  return (
    <div class="box items-center gap-2 self-stretch">
      <FriendProfileAvatar
        profile={props.profile}
        size={props.avatarSize ?? 96}
      />
      <div class="box items-center gap-1 self-stretch">
        <h1 class="text textTitle line-clamp-1 text-center">{handle()}</h1>
      </div>
      {props.trailing}
    </div>
  );
}
