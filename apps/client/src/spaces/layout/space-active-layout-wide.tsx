import { SpaceSessionMemberRail } from '@gamezilla/client/spaces/layout/space-session-member-rail';
import { SpaceWideRailFooter } from '@gamezilla/client/spaces/layout/space-wide-rail-footer';
import { SpaceWideRailHeader } from '@gamezilla/client/spaces/layout/space-wide-rail-header';
import { Box } from '@gamezilla/lib/ui';
import type { ReactNode } from 'react';

const RAIL_WIDTH = 276;

export type SpaceActiveLayoutWideProps = {
  spaceId: string;
  isHost: boolean;
  onRequestEnd: () => void;
  onRequestLeave: () => void;
  onPressHome: () => void;
  onPressDebug: () => void;
  children: ReactNode;
};

export function SpaceActiveLayoutWide({
  spaceId,
  isHost,
  onRequestEnd,
  onRequestLeave,
  onPressHome,
  onPressDebug,
  children,
}: SpaceActiveLayoutWideProps): ReactNode {
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
        <SpaceWideRailHeader
          spaceId={spaceId}
          onPressHome={onPressHome}
        />
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <SpaceSessionMemberRail spaceId={spaceId} />
        </Box>
        <SpaceWideRailFooter
          isHost={isHost}
          onRequestEnd={onRequestEnd}
          onRequestLeave={onRequestLeave}
          onPressDebug={onPressDebug}
        />
      </Box>
      <Box
        sx={{ flex: 1, minHeight: 0, minWidth: 0, justifyContent: 'center' }}
      >
        {children}
      </Box>
    </Box>
  );
}
