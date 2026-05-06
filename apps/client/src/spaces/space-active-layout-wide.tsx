import { Box } from '@gamezilla/lib/ui';
import type { ReactNode } from 'react';

import { SpaceSessionMemberRail } from './space-session-member-rail';
import { SpaceWideRailFooter } from './space-wide-rail-footer';
import { SpaceWideRailHeader } from './space-wide-rail-header';
import type { SpaceMemberRow } from './types';
import type { MemberPresenceFlags } from './use-member-presence-flags';

const RAIL_WIDTH = 276;

export type SpaceActiveLayoutWideProps = {
  spaceTitle: string;
  host: SpaceMemberRow | null;
  guests: SpaceMemberRow[];
  flags: Map<string, MemberPresenceFlags>;
  isHost: boolean;
  onRequestEnd: () => void;
  onRequestLeave: () => void;
  onPressHome: () => void;
  onPressDebug: () => void;
  children: ReactNode;
};

export function SpaceActiveLayoutWide({
  spaceTitle,
  host,
  guests,
  flags,
  isHost,
  onRequestEnd,
  onRequestLeave,
  onPressHome,
  onPressDebug,
  children,
}: SpaceActiveLayoutWideProps) {
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
        <SpaceWideRailHeader spaceTitle={spaceTitle} onPressHome={onPressHome} />
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <SpaceSessionMemberRail host={host} guests={guests} flags={flags} />
        </Box>
        <SpaceWideRailFooter
          isHost={isHost}
          onRequestEnd={onRequestEnd}
          onRequestLeave={onRequestLeave}
          onPressDebug={onPressDebug}
        />
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, justifyContent: 'center' }}>
        {children}
      </Box>
    </Box>
  );
}
