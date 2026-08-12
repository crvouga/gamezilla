import { useLingui } from '@lingui/react/macro';
import {
  Box,
  StatusBar,
  StatusBarRegistryPortalBridge,
  StatusBarRegistryProvider,
} from '@pkgs/ui';
import type { ReactNode } from 'react';

import { AppStatusBarItems } from '../../ui/status-bar/app-status-bar-items';

/**
 * Global smartphone-style status bar: thin indicator strip + expanded panel.
 * Mount after UI portals so {@link StatusBar}'s ResponsiveSurface works, and
 * after inbox so notification items can read unread counts.
 *
 * {@link StatusBarRegistryPortalBridge} re-provides the registry inside
 * portaled surface content (panels that call {@link useStatusBar}).
 */
export function AppStatusBarRegistry({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { t } = useLingui();
  return (
    <StatusBarRegistryProvider>
      <StatusBarRegistryPortalBridge>
        <AppStatusBarItems />
        <Box sx={{ flex: 1 }}>
          <StatusBar
            accessibilityLabel={t`Status bar`}
            panelTitle={t`Status`}
          />
          <Box sx={{ flex: 1 }}>{children}</Box>
        </Box>
      </StatusBarRegistryPortalBridge>
    </StatusBarRegistryProvider>
  );
}
