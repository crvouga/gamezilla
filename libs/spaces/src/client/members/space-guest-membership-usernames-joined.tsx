import { type SxProps, Text, type TextVariant } from '@pkgs/ui';
import { optionalProps } from '@pkgs/ui/components/optional-props';
import { Fragment, type ReactNode } from 'react';
import { SpaceGuestMembershipUsername } from './space-guest-membership-username';
import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';

export type SpaceGuestMembershipUsernamesJoinedProps = {
  spaceId: string;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
};

const SEPARATOR = ', ';

/**
 * Comma-separated guest usernames for a space. Each name is its own atom;
 * the separator is purely typographic glue between atoms.
 */
export function SpaceGuestMembershipUsernamesJoined({
  spaceId,
  variant,
  sx,
  numberOfLines,
}: SpaceGuestMembershipUsernamesJoinedProps): ReactNode {
  const membershipIds = useSpaceGuestMembershipIds(spaceId);
  if (membershipIds.length === 0) return null;
  return (
    <Text {...optionalProps({ variant, sx, numberOfLines })}>
      {membershipIds.map((mid, idx) => (
        <Fragment key={mid}>
          {idx > 0 ? SEPARATOR : null}
          <SpaceGuestMembershipUsername
            membershipId={mid}
            {...optionalProps({ variant })}
          />
        </Fragment>
      ))}
    </Text>
  );
}
