import { UserUsername } from '@libs/profile/public/user-username';
import type { SxProps, TextVariant } from '@pkgs/ui';
import type { JSX } from 'solid-js';

export type SpaceGuestMembershipUsernameProps = {
  /** Guest member / account id (also the profile id). */
  membershipId: string;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
};

export function SpaceGuestMembershipUsername(
  props: SpaceGuestMembershipUsernameProps
): JSX.Element {
  return (
    <UserUsername
      profileId={props.membershipId}
      withAt={false}
      variant={props.variant}
      sx={props.sx}
      numberOfLines={props.numberOfLines}
    />
  );
}
