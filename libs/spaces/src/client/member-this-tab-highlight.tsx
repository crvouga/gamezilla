import { useMemberIsThisTab } from './use-member-is-this-tab';
import { Box } from '@gamezilla/ui';
import type { ReactNode } from 'react';

export type MemberThisTabHighlightProps = {
  spaceId: string;
  profileId: string;
  borderRadius: number;
  children: ReactNode;
};

/**
 * Decorator that applies a 2px primary border + matching radius around its
 * children when the member's active session is this tab; otherwise renders
 * children with no border.
 */
export function MemberThisTabHighlight({
  spaceId,
  profileId,
  borderRadius,
  children,
}: MemberThisTabHighlightProps): ReactNode {
  const isThisTab = useMemberIsThisTab(spaceId, profileId);
  return (
    <Box
      sx={{
        borderRadius,
        borderWidth: isThisTab ? 2 : 0,
        borderColor: isThisTab ? 'primary' : 'transparent',
      }}
    >
      {children}
    </Box>
  );
}
