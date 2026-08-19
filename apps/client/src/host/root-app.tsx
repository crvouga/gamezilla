// @io-wall-ok — Expo composition root for Client | System sub-apps.

import { ClientHost } from '@apps/client/host/client-host';
import { composeSubApps } from '@apps/client/host/compose-sub-apps';
import { HostChromeProvider } from '@apps/client/host/host-chrome-context';
import { useHostNav } from '@apps/client/host/use-host-nav';
import { wallIo } from '@pkgs/io';
import { SystemProvider } from '@pkgs/system/react';
import { AppThemeRoot, Box } from '@pkgs/ui';
import { type ReactNode, useMemo } from 'react';

/** Expo root: host chrome + Client (product) / System (console + playground). */
export function RootApp(): ReactNode {
  const io = useMemo(() => wallIo(), []);
  const apps = useMemo(() => composeSubApps(), []);
  const hostNav = useHostNav();
  return (
    <SystemProvider io={io}>
      <AppThemeRoot>
        <HostChromeProvider value={hostNav}>
          <Box sx={rootSx}>
            <ClientHost apps={apps} />
          </Box>
        </HostChromeProvider>
      </AppThemeRoot>
    </SystemProvider>
  );
}

const rootSx = {
  flex: 1,
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  minHeight: 0,
} as const;
