import { Box, NavRail } from '@gamezilla/ui';
import type { ReactNode } from 'react';

import { SpaceSessionMemberRail } from './space-session-member-rail';
import { useSpaceSessionUi } from './space-session-ui-context';
import { SpaceWideRailHeader } from './space-wide-rail-header';

export type SpaceActiveLayoutWideProps = {
  children: ReactNode;
};

export function SpaceActiveLayoutWide({
  children,
}: SpaceActiveLayoutWideProps): ReactNode {
  const { spaceId } = useSpaceSessionUi();

  return (
    <Box sx={{ flex: 1, minHeight: 0, flexDirection: 'row' }}>
      <NavRail header={<SpaceWideRailHeader />}>
        <SpaceSessionMemberRail spaceId={spaceId} />
      </NavRail>
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
