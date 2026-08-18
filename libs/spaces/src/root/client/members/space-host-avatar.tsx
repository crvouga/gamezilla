import { UserProfileAvatar } from '@libs/profile/public/user-profile-avatar';
import type { ReactNode } from 'react';

import { useSpaceHostMembershipDisplay } from './use-space-host-membership-display';

export type SpaceHostAvatarProps = {
  spaceId: string;
  size: number;
  vividBackdrop?: boolean;
};

export function SpaceHostAvatar({
  spaceId,
  size,
  vividBackdrop,
}: SpaceHostAvatarProps): ReactNode {
  const host = useSpaceHostMembershipDisplay(spaceId);
  return (
    <UserProfileAvatar
      profileId={host?.profileId ?? null}
      size={size}
      vividBackdrop={vividBackdrop ?? false}
    />
  );
}
