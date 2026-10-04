import { UserUsername } from '@libs/profile-client/user-username';
import type { TextVariant } from '@pkgs/ui-client/text';
import type { JSX } from 'solid-js';

export type SpaceGuestMembershipUsernameProps = {
  /** Guest member / account id (also the profile id). */
  membershipId: string;
  variant?: TextVariant;
  class?: string;
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
      class={props.class}
      numberOfLines={props.numberOfLines}
    />
  );
}
