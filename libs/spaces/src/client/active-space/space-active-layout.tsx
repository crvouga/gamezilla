import { Box, TopBar } from '@gamezilla/ui';
import type { ReactNode } from 'react';

import { SpaceMembersAvatarGroup } from '../members/space-members-avatar-group';
import { SpaceChromeBackButton } from './space-chrome-back-button';
import { SpaceChromeHomeButton } from './space-chrome-home-button';
import { SpaceChromeOverflowMenu } from './space-chrome-overflow-menu';
import { useSpaceSessionUi } from './space-session-ui-context';

export type SpaceActiveLayoutProps = {
  children: ReactNode;
};

/**
 * Unified active-space chrome. A single top bar (home + back + members
 * pill + overflow) sits above the full-width body on every breakpoint —
 * no desktop sidebar / wide-rail variant. The compact members list is
 * reachable through the avatar pill's modal.
 */
export function SpaceActiveLayout({
  children,
}: SpaceActiveLayoutProps): ReactNode {
  const { spaceId } = useSpaceSessionUi();
  return (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      <TopBar
        leading={
          <>
            <SpaceChromeHomeButton />
            <SpaceChromeBackButton />
          </>
        }
        centerAlign="end"
        center={<SpaceMembersAvatarGroup spaceId={spaceId} />}
        trailing={<SpaceChromeOverflowMenu />}
      />
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          justifyContent: 'flex-start',
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
