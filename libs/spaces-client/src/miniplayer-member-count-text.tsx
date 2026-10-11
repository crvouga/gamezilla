import { Plural } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';

import { useSpaceMemberCount } from './use-space-member-count';

export type MiniplayerMemberCountTextProps = {
  spaceId: string;
  class?: string;
};

/** "1 person here" / "N people here" caption inside a miniplayer card. */
export function MiniplayerMemberCountText(
  props: MiniplayerMemberCountTextProps
): JSX.Element {
  const count = useSpaceMemberCount(props.spaceId);
  return (
    <p
      class="text textCaption line-clamp-1 shrink-0 min-w-0"
      classList={{
        ...(props.class !== undefined ? { [props.class]: true } : {}),
      }}
    >
      <Plural value={count()} one="# person here" other="# people here" />
    </p>
  );
}
