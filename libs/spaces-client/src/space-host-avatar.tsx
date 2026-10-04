import { UserProfileAvatar } from '@libs/profile-client/user-profile-avatar';
import type { JSX } from 'solid-js';

import { useSpaceHostMembershipDisplay } from './use-space-host-membership-display';

export type SpaceHostAvatarProps = {
  spaceId: string;
  size: number;
  vividBackdrop?: boolean;
};

export function SpaceHostAvatar(props: SpaceHostAvatarProps): JSX.Element {
  const host = useSpaceHostMembershipDisplay(props.spaceId);
  return (
    <UserProfileAvatar
      profileId={host()?.profileId ?? null}
      size={props.size}
      vividBackdrop={props.vividBackdrop ?? false}
    />
  );
}
