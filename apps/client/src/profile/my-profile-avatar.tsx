import { useMyProfileId } from '@gamezilla/client/profile/use-my-profile-id';
import { UserProfileAvatar } from '@gamezilla/client/profile/user-profile-avatar';
import type { ReactNode } from 'react';

export type MyProfileAvatarProps = {
  size: number;
  vividBackdrop?: boolean;
};

/** Sugar: `<UserProfileAvatar profileId={useMyProfileId()} … />`. */
export function MyProfileAvatar({
  size,
  vividBackdrop,
}: MyProfileAvatarProps): ReactNode {
  const profileId = useMyProfileId();
  return (
    <UserProfileAvatar
      profileId={profileId}
      size={size}
      vividBackdrop={vividBackdrop ?? false}
    />
  );
}
