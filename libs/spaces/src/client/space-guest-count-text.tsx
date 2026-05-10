import { useSpaceGuestMembershipIds } from '@gamezilla/client/spaces/guests/use-space-guest-membership-ids';
import { optionalProps } from '@gamezilla/client/ui/optional-props';
import { Text, type SxProps, type TextVariant } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type SpaceGuestCountTextProps = {
  spaceId: string;
  variant?: TextVariant;
  sx?: SxProps;
};

/** Localized "1 guest" / "N guests" line for a space. */
export function SpaceGuestCountText({
  spaceId,
  variant,
  sx,
}: SpaceGuestCountTextProps): ReactNode {
  const { t } = useLingui();
  const ids = useSpaceGuestMembershipIds(spaceId);
  const count = ids.length;
  const label = count === 1 ? t`1 guest` : t`${count} guests`;
  return <Text {...optionalProps({ variant, sx })} label={label} />;
}
