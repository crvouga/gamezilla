import { UserProfileAvatar } from '@libs/profile/client/user-profile-avatar';
import type { ReactNode } from 'react';

import {
  useSpaceMembershipColumn,
  SpaceMembershipField,
} from '../use-space-membership-column';

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
  const profileId = useSpaceMembershipColumn(
    membershipId,
    SpaceMembershipField.profileId
  );
  const guestId = useSpaceMembershipColumn(
    membershipId,
    SpaceMembershipField.guestId
  );
  const resolved =
    profileId !== null && profileId.length > 0 ? profileId : guestId;
  return (
    <UserProfileAvatar
      profileId={resolved}
      size={size}
      vividBackdrop={vividBackdrop ?? false}
    />
  );
}
