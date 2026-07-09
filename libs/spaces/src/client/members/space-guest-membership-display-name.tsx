import { UserDisplayName } from '@libs/profile/client/user-display-name';
import { optionalProps } from '@pkgs/ui/components/optional-props';
import type { SxProps, TextVariant } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { useSpaceMembershipColumn, SpaceMembershipField } from '../use-space-membership-column';

export type SpaceGuestMembershipDisplayNameProps = {
  membershipId: string;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
};

export function SpaceGuestMembershipDisplayName({
  membershipId,
  variant,
  sx,
  numberOfLines,
}: SpaceGuestMembershipDisplayNameProps): ReactNode {
  const guestId = useSpaceMembershipColumn(membershipId, SpaceMembershipField.guestId);
  return (
    <UserDisplayName
      profileId={guestId}
      {...optionalProps({ variant, sx, numberOfLines })}
    />
  );
}
