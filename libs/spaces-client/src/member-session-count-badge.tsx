import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import { useMemberSessionCount } from './use-member-session-count';

export type MemberSessionCountBadgeProps = {
  spaceId: string;
  profileId: string;
};

/**
 * `·N` badge showing how many tabs/devices the member is connected from.
 * Renders nothing when the count is 1 or fewer.
 */
export function MemberSessionCountBadge(
  props: MemberSessionCountBadgeProps
): JSX.Element {
  const count = useMemberSessionCount(props.spaceId, props.profileId);
  return (
    <Show when={count() > 1}>
      <p class="text textCaption text-text-secondary">{`·${String(count())}`}</p>
    </Show>
  );
}
