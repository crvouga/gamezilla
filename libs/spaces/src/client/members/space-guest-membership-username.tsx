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
  const profileId = useSpaceMembershipColumn(
    membershipId,
    SpaceMembershipField.profileId
  );
  const memberId = useSpaceMembershipColumn(
    membershipId,
    SpaceMembershipField.memberId
  );
  const resolved =
    profileId !== null && profileId.length > 0 ? profileId : memberId;
  return (
    <UserUsername
      profileId={resolved}
      withAt={false}
      {...optionalProps({ variant, sx, numberOfLines })}
    />
  );
}
