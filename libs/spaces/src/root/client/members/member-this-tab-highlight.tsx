import { Box } from '@pkgs/ui';
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
    <Box
      sx={{
        borderRadius: props.borderRadius,
        borderWidth: isThisTab() ? 2 : 0,
        borderColor: isThisTab() ? 'primary' : 'transparent',
      }}
    >
      {props.children}
    </Box>
  );
}
