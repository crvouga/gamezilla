import { useLingui } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';
import { createMemo } from 'solid-js';

import { useSpaceMemberCount } from '../members/use-space-member-count';

export type MiniplayerMemberCountTextProps = {
  spaceId: string;
};

/** "N people here" caption inside a miniplayer card. */
export function MiniplayerMemberCountText(
  props: MiniplayerMemberCountTextProps
): JSX.Element {
  const { t } = useLingui();
  const count = useSpaceMemberCount(props.spaceId);
  const label = createMemo(() => t`${count()} people here`);
  return <p class="text textCaption line-clamp-1">{label()}</p>;
}
