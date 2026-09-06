import { useLingui } from '@lingui/react/macro';
import { type SxProps, Text, type TextVariant } from '@pkgs/ui-rn';
import { optionalProps } from '@pkgs/ui-rn/components/optional-props';
import type { ReactNode } from 'react';
import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';

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
