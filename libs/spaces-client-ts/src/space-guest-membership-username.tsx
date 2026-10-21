import { UserUsername } from '@libs/profile-client-ts/user-username';
import type { TextRole } from '@pkgs/ui-root-client-ts/text';
import type { TextLines } from '@pkgs/ui-root-client-ts/text-classes';
import type { JSX } from 'solid-js';

export type SpaceGuestMembershipUsernameProps = {
  /** Guest member / account id (also the profile id). */
  membershipId: string;
  variant?: TextRole;
  numberOfLines?: TextLines;
};

export function SpaceGuestMembershipUsername(
  props: SpaceGuestMembershipUsernameProps
): JSX.Element {
  return (
    <UserUsername
      profileId={props.membershipId}
      withAt={false}
      variant={props.variant}
      numberOfLines={props.numberOfLines}
    />
  );
}
