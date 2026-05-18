import { TopBar } from '@gamezilla/ui';
import type { ReactNode } from 'react';

import { SpaceChromeBackButton } from './space-chrome-back-button';
import { SpaceChromeHomeButton } from './space-chrome-home-button';
import { SpaceChromeOverflowMenu } from './space-chrome-overflow-menu';

/**
 * Wide-rail top bar: always-visible home + conditional back, plus the
 * overflow menu on the trailing edge. The space title is intentionally
 * absent—the active-space context is conveyed by route + member list.
 */
export function SpaceWideRailHeader(): ReactNode {
  return (
    <TopBar
      leading={
        <>
          <SpaceChromeHomeButton />
          <SpaceChromeBackButton />
        </>
      }
      trailing={<SpaceChromeOverflowMenu />}
    />
  );
}
