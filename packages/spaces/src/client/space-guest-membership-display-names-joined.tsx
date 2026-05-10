import { SpaceGuestMembershipDisplayName } from './space-guest-membership-display-name';
import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';
import { optionalProps } from '@gamezilla/client/ui/optional-props';
import { Text, type SxProps, type TextVariant } from '@gamezilla/ui';
import { Fragment, type ReactNode } from 'react';

export type SpaceGuestMembershipDisplayNamesJoinedProps = {
  spaceId: string;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
};

const SEPARATOR = ', ';

/**
 * Comma-separated guest display names for a space. Each name is its own atom;
 * the separator is purely typographic glue between atoms.
 */
export function SpaceGuestMembershipDisplayNamesJoined({
  spaceId,
  variant,
  sx,
  numberOfLines,
}: SpaceGuestMembershipDisplayNamesJoinedProps): ReactNode {
  const membershipIds = useSpaceGuestMembershipIds(spaceId);
  if (membershipIds.length === 0) return null;
  return (
    // eslint-disable-next-line gamezillaText/text-use-label -- nested <Text> atoms with separators; cannot collapse to a single label string
    <Text {...optionalProps({ variant, sx, numberOfLines })}>
      {membershipIds.map((mid, idx) => (
        <Fragment key={mid}>
          {idx > 0 ? SEPARATOR : null}
          <SpaceGuestMembershipDisplayName
            membershipId={mid}
            {...optionalProps({ variant })}
          />
        </Fragment>
      ))}
    </Text>
  );
}
