import { Box, TopBar } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { SpaceMembersAvatarGroup } from '../members/space-members-avatar-group';
import { SpaceChromeActionBar } from './space-chrome-action-bar';
import { SpaceChromeBackButton } from './space-chrome-back-button';
import { SpaceChromeHomeButton } from './space-chrome-home-button';
import { useSpaceSessionUi } from './space-session-ui-context';

export type SpaceActiveLayoutProps = {
  children: ReactNode;
};

/**
 * Unified active-space chrome. A single top bar (back + members pill +
 * responsive actions) sits above the full-width body. The compact members
 * list is reachable through the avatar pill's modal.
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
        trailing={<SpaceChromeActionBar />}
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
