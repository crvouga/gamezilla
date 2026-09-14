import { parseAvatarConfig } from '@libs/profile/public/avatar-config';
import { DeviceAvatar } from '@libs/profile/public/device-avatar';
import type { JSX } from 'solid-js';

import type { FriendProfile } from '../shared/friendship/friends-types';

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
