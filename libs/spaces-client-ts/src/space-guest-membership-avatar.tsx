import { UserProfileAvatar } from '@libs/profile-client-ts/user-profile-avatar';
import type { JSX } from 'solid-js';

export type SpaceGuestMembershipAvatarProps = {
  /** Guest member / account id (also the profile id). */
  membershipId: string;
  size: number;
  vividBackdrop?: boolean;
};

export function SpaceGuestMembershipAvatar(
  props: SpaceGuestMembershipAvatarProps
): JSX.Element {
  return (
    <UserProfileAvatar
      profileId={props.membershipId}
      size={props.size}
      vividBackdrop={props.vividBackdrop ?? false}
    />
  );
}
