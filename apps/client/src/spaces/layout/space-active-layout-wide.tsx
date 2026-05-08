import { SpaceSessionMemberRail } from '@gamezilla/client/spaces/layout/space-session-member-rail';
import { useSpaceSessionUi } from '@gamezilla/client/spaces/layout/space-session-ui-context';
import { SpaceWideRailFooter } from '@gamezilla/client/spaces/layout/space-wide-rail-footer';
import { SpaceWideRailHeader } from '@gamezilla/client/spaces/layout/space-wide-rail-header';
import { Box } from '@gamezilla/lib/ui';
import type { ReactNode } from 'react';

const RAIL_WIDTH = 276;

export type SpaceActiveLayoutWideProps = {
  children: ReactNode;
};

export function SpaceActiveLayoutWide({
  children,
}: SpaceActiveLayoutWideProps): ReactNode {
  const { spaceId, onPressHome } = useSpaceSessionUi();

  return (
    <Box sx={{ flex: 1, minHeight: 0, flexDirection: 'row' }}>
      <Box
        sx={{
          width: RAIL_WIDTH,
          minHeight: 0,
          flexDirection: 'column',
          borderRightWidth: 1,
          borderColor: 'border',
          background: 'surface',
        }}
      >
        <SpaceWideRailHeader spaceId={spaceId} onPressHome={onPressHome} />
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <SpaceSessionMemberRail spaceId={spaceId} />
        </Box>
        <SpaceWideRailFooter />
      </Box>
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
