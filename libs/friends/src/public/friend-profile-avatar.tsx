import { parseAvatarConfig } from '@libs/profile/public/avatar-config';
import { DeviceAvatar } from '@libs/profile/public/device-avatar';
import type { ReactNode } from 'react';

import type { FriendProfile } from '../shared/friendship/friends-types';

export type FriendProfileAvatarProps = {
  readonly profile: FriendProfile;
  readonly size: number;
};

export function FriendProfileAvatar({
  profile,
  size,
}: FriendProfileAvatarProps): ReactNode {
  return (
    <DeviceAvatar
      avatarConfig={parseAvatarConfig(profile.avatarConfig)}
      seedFallback={profile.userId}
      size={size}
    />
  );
}
