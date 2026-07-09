import { UserProfileAvatar } from '@libs/profile/client/user-profile-avatar';
import type { ReactNode } from 'react';

import { useSpaceColumn, SpaceField } from '../use-space-column';

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
  const hostId = useSpaceColumn(spaceId, SpaceField.hostId);
  return (
    <UserProfileAvatar
      profileId={hostId}
      size={size}
      vividBackdrop={vividBackdrop ?? false}
    />
  );
}
