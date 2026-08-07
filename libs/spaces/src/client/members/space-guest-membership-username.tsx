import { UserUsername } from '@libs/profile/client/user-username';
import type { SxProps, TextVariant } from '@pkgs/ui';
import { optionalProps } from '@pkgs/ui/components/optional-props';
import type { ReactNode } from 'react';

export type SpaceGuestMembershipUsernameProps = {
  /** Guest member / account id (also the profile id). */
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
  return (
    <UserUsername
      profileId={membershipId}
      withAt={false}
      {...optionalProps({ variant, sx, numberOfLines })}
    />
  );
}
