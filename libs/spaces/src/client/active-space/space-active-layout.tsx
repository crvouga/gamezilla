import { Box, TopBar } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { useSpaceSessionUi } from './space-session-ui-context';
import { SpaceEventLogChrome } from './space-event-log-chrome';
import {
  SpaceChromeLeadingActionBar,
  SpaceChromeTrailingActionBar,
} from './space-chrome-action-bar';

export type SpaceActiveLayoutProps = {
  children: ReactNode;
};

/**
 * Unified active-space chrome. Leading ActionBar owns exit + back; trailing
 * ActionBar owns members + management actions above the full-width body.
 * Persistent event-log bar sits under the body.
 */
export function SpaceActiveLayout({
  children,
}: SpaceActiveLayoutProps): ReactNode {
  const { spaceId } = useSpaceSessionUi();
  return (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      <TopBar
        leading={<SpaceChromeLeadingActionBar />}
        trailing={<SpaceChromeTrailingActionBar />}
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
      <SpaceEventLogChrome spaceId={spaceId} />
    </Box>
  );
}
