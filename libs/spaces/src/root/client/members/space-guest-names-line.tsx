import type { SxProps, TextVariant } from '@pkgs/ui-rn';
import { optionalProps } from '@pkgs/ui-rn/components/optional-props';
import type { ReactNode } from 'react';
import { NoGuestsText } from './no-guests-text';
import { SpaceGuestMembershipUsernamesJoined } from './space-guest-membership-usernames-joined';
import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';

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
    <SpaceGuestMembershipUsernamesJoined
      spaceId={spaceId}
      {...optionalProps({ variant, sx, numberOfLines })}
    />
  );
}
