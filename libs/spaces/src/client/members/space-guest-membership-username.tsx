import { UserUsername } from '@libs/profile/client/user-username';
import { optionalProps } from '@pkgs/ui/components/optional-props';
import type { SxProps, TextVariant } from '@pkgs/ui';
import type { ReactNode } from 'react';

import {
  useSpaceMembershipColumn,
  SpaceMembershipField,
} from '../use-space-membership-column';

export type SpaceGuestMembershipUsernameProps = {
  membershipId: string;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
};

export function SpaceGuestMembershipUsername({
  membershipId,
  variant,
  sx,
  numberOfLines,
}: SpaceGuestMembershipUsernameProps): ReactNode {
  const guestId = useSpaceMembershipColumn(
    membershipId,
    SpaceMembershipField.guestId
  );
  return (
    <UserUsername
      profileId={guestId}
      withAt={false}
      {...optionalProps({ variant, sx, numberOfLines })}
    />
  );
}
