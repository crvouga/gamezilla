import { UserProfileAvatar } from '@gamezilla/client/profile/user-profile-avatar';
import {
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceMembershipAttr,
} from '@gamezilla/domain/spaces/space-entities';
import { useQueryAttribute } from '@gamezilla/patch-db/react';
import type { ReactNode } from 'react';

export type SpaceGuestMembershipAvatarProps = {
  membershipId: string;
  size: number;
  vividBackdrop?: boolean;
};

/** Avatar for the guest profile referenced by a space membership row. */
export function SpaceGuestMembershipAvatar({
  membershipId,
  size,
  vividBackdrop,
}: SpaceGuestMembershipAvatarProps): ReactNode {
  const guestId = useQueryAttribute({
    entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
    entityId: membershipId,
    attributeKey: SpaceMembershipAttr.guestId.key,

    parse: SpaceMembershipAttr.guestId.parse,
  });
  return (
    <UserProfileAvatar
      profileId={guestId}
      size={size}
      vividBackdrop={vividBackdrop ?? false}
    />
  );
}
