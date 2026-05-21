import { UserDisplayName } from '@libs/profile/client/user-display-name';
import { optionalProps } from '@pkgs/ui/components/optional-props';
import {
  SPACE_MEMBERSHIP_ENTITY_TYPE,
  SpaceMembershipAttr,
} from '@libs/spaces/shared/space-entities';
import type { SxProps, TextVariant } from '@pkgs/ui';
import { useQueryAttribute } from '@pkgs/patch-db/react';
import type { ReactNode } from 'react';

export type SpaceGuestMembershipDisplayNameProps = {
  membershipId: string;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
};

/** Display name for the guest profile referenced by a space membership row. */
export function SpaceGuestMembershipDisplayName({
  membershipId,
  variant,
  sx,
  numberOfLines,
}: SpaceGuestMembershipDisplayNameProps): ReactNode {
  const guestId = useQueryAttribute({
    entityType: SPACE_MEMBERSHIP_ENTITY_TYPE,
    entityId: membershipId,
    attribute: SpaceMembershipAttr.guestId,
  });
  return (
    <UserDisplayName
      profileId={guestId}
      {...optionalProps({ variant, sx, numberOfLines })}
    />
  );
}
