import { useLingui } from '@lingui/solid/macro';
import { P } from '@pkgs/ui-root-client/text';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';

import { useSpaceGuestMembershipIds } from './use-space-guest-membership-ids';

export type SpaceGuestCountTextProps = {
  spaceId: string;
};

/** Localized "1 guest" / "N guests" caption for a space. */
export function SpaceGuestCountText(
  props: SpaceGuestCountTextProps
): JSX.Element {
  const { t } = useLingui();
  const ids = useSpaceGuestMembershipIds(props.spaceId);
  const label = createMemo(() => {
    const count = ids().length;
    return count === 1 ? t`1 guest` : t`${count} guests`;
  });
  return <P variant="caption">{label()}</P>;
}
