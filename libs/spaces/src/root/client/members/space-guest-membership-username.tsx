import { UserUsername } from '@libs/profile/public/user-username';
import type { SxProps, TextVariant } from '@pkgs/ui-rn';
import { optionalProps } from '@pkgs/ui-rn/components/optional-props';
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
