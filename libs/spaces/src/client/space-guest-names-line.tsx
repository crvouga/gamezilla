import { NoGuestsText } from './no-guests-text';
import { SpaceGuestMembershipDisplayNamesJoined } from './space-guest-membership-display-names-joined';
import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';
import { optionalProps } from '@gamezilla/client/ui/optional-props';
import type { SxProps, TextVariant } from '@gamezilla/lib/ui';
import type { ReactNode } from 'react';

export type SpaceGuestNamesLineProps = {
  spaceId: string;
  variant?: TextVariant;
  sx?: SxProps;
  numberOfLines?: number;
};

/**
 * Single-line summary of a space's guests: shows the joined names list when
 * there are guests, otherwise a localized "No guests yet" placeholder.
 */
export function SpaceGuestNamesLine({
  spaceId,
  variant,
  sx,
  numberOfLines,
}: SpaceGuestNamesLineProps): ReactNode {
  const membershipIds = useSpaceGuestMembershipIds(spaceId);
  if (membershipIds.length === 0) {
    return <NoGuestsText {...optionalProps({ variant, sx, numberOfLines })} />;
  }
  return (
    <SpaceGuestMembershipDisplayNamesJoined
      spaceId={spaceId}
      {...optionalProps({ variant, sx, numberOfLines })}
    />
  );
}
