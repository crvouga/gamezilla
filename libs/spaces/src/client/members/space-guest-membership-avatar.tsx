import { UserProfileAvatar } from '@libs/profile/client/user-profile-avatar';
import type { ReactNode } from 'react';

import { useSpaceMembershipColumn, SpaceMembershipField } from '../use-space-membership-column';

export type SpaceGuestMembershipAvatarProps = {
  membershipId: string;
  size: number;
  vividBackdrop?: boolean;
};

export function SpaceGuestMembershipAvatar({
  membershipId,
  size,
  vividBackdrop,
}: SpaceGuestMembershipAvatarProps): ReactNode {
  const guestId = useSpaceMembershipColumn(membershipId, SpaceMembershipField.guestId);
  return (
    <UserProfileAvatar
      profileId={guestId}
      size={size}
      vividBackdrop={vividBackdrop ?? false}
    />
  );
}
