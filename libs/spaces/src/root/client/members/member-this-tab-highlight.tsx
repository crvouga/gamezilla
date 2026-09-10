import type { JSX } from 'solid-js';

import { useMemberIsThisTab } from './use-member-is-this-tab';

export type MemberThisTabHighlightProps = {
  spaceId: string;
  profileId: string;
  borderRadius: number;
  children: JSX.Element;
};

/**
 * Decorator that applies a 2px primary border + matching radius around its
 * children when the member's active session is this tab; otherwise renders
 * children with no border.
 */
export function MemberThisTabHighlight(
  props: MemberThisTabHighlightProps
): JSX.Element {
  const isThisTab = useMemberIsThisTab(props.spaceId, props.profileId);
  return (
    <div
      class="box"
      style={{
        'border-radius': `${props.borderRadius}px`,
        'border-color': isThisTab() ? 'primary' : 'transparent',
        'border-width': `${isThisTab() ? 2 : 0}px`,
      }}
    >
      {props.children}
    </div>
  );
}
