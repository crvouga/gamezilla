import { UserProfileAvatar } from '@libs/profile/public/user-profile-avatar';
import type { ReactNode } from 'react';

export type SpaceGuestMembershipAvatarProps = {
  /** Guest member / account id (also the profile id). */
  membershipId: string;
  size: number;
  vividBackdrop?: boolean;
};

export function SpaceGuestMembershipAvatar({
  membershipId,
  size,
  vividBackdrop,
}: SpaceGuestMembershipAvatarProps): ReactNode {
  return (
    <UserProfileAvatar
      profileId={membershipId}
      size={size}
      vividBackdrop={vividBackdrop ?? false}
    />
  );
}
