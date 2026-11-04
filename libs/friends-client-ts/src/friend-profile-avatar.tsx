import type { FriendProfile } from '@libs/friends-shared-ts/friends-types';
import { DeviceAvatar } from '@libs/profile-client-ts/device-avatar';
import { parseAvatarConfig } from '@libs/profile-shared-ts/avatar-config';
import type { JSX } from 'solid-js';

export type FriendProfileAvatarProps = {
  readonly profile: FriendProfile;
  readonly size: number;
  /** The name the row shows; its initials stand in for a missing picture. */
  readonly name?: string | undefined;
};

export function FriendProfileAvatar(
  props: FriendProfileAvatarProps
): JSX.Element {
  return (
    <DeviceAvatar
      avatarConfig={parseAvatarConfig(props.profile.avatarConfig)}
      seedFallback={props.profile.userId}
      name={props.name}
      size={props.size}
    />
  );
}
