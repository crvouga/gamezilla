import { useLingui } from '@lingui/solid/macro';
import { Text, type TextVariant } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';

import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';

export type SpaceGuestCountTextProps = {
  spaceId: string;
  variant?: TextVariant;
  class?: string;
};

/** Localized "1 guest" / "N guests" line for a space. */
export function SpaceGuestCountText(
  props: SpaceGuestCountTextProps
): JSX.Element {
  const { t } = useLingui();
  const ids = useSpaceGuestMembershipIds(props.spaceId);
  const label = createMemo(() => {
    const count = ids().length;
    return count === 1 ? t`1 guest` : t`${count} guests`;
  });
  return <Text variant={props.variant} class={props.class} label={label()} />;
}
