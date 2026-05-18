import { TopBar } from '@gamezilla/ui';
import type { ReactNode } from 'react';

import { Box } from '@gamezilla/ui';

import { SpaceMembersAvatarGroup } from '../members/space-members-avatar-group';
import { SpaceChromeBackButton } from './space-chrome-back-button';
import { SpaceChromeHomeButton } from './space-chrome-home-button';
import { SpaceChromeOverflowMenu } from './space-chrome-overflow-menu';
import { useSpaceSessionUi } from './space-session-ui-context';

export type SpaceActiveLayoutMobileProps = {
  children: ReactNode;
};

export function SpaceActiveLayoutMobile({
  children,
}: SpaceActiveLayoutMobileProps): ReactNode {
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
      <Box sx={{ flex: 1, minHeight: 0, justifyContent: 'flex-start' }}>
        {children}
      </Box>
    </Box>
  );
}
