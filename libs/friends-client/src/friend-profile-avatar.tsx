import { parseAvatarConfig } from '@libs/profile-shared/avatar-config';
import { DeviceAvatar } from '@libs/profile-client/device-avatar';
import type { JSX } from 'solid-js';

import type { FriendProfile } from '@libs/friends-shared/friends-types';

export type FriendProfileAvatarProps = {
  readonly profile: FriendProfile;
  readonly size: number;
};

export function FriendProfileAvatar(
  props: FriendProfileAvatarProps
): JSX.Element {
  return (
    <DeviceAvatar
      avatarConfig={parseAvatarConfig(props.profile.avatarConfig)}
      seedFallback={props.profile.userId}
      size={props.size}
    />
  );
}
