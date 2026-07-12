import { Box, TopBar } from '@pkgs/ui';
import type { ReactNode } from 'react';

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
 */
export function SpaceActiveLayout({
  children,
}: SpaceActiveLayoutProps): ReactNode {
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
    </Box>
  );
}
