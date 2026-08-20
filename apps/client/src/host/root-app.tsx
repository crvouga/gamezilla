// @io-wall-ok — Expo composition root for Client | System sub-apps.

import { ClientHost } from '@apps/client/host/client-host';
import { composeSubApps } from '@apps/client/host/compose-sub-apps';
import { HostChromeProvider } from '@apps/client/host/host-chrome-context';
import { useHostNav } from '@apps/client/host/use-host-nav';
import { ClockProvider, wallClock, wallTimers } from '@pkgs/clock';
import { AppThemeRoot, Box } from '@pkgs/ui';
import { IdProvider } from '@pkgs/uuid';
import { type ReactNode, useMemo } from 'react';

/** Expo root: host chrome + Client (product) / System (console + playground). */
export function RootApp(): ReactNode {
  const apps = useMemo(() => composeSubApps(), []);
  const hostNav = useHostNav();
  const createId = useMemo(() => () => crypto.randomUUID(), []);
  const random = useMemo(() => () => Math.random(), []);
  return (
    <ClockProvider clock={wallClock} timers={wallTimers}>
      <IdProvider createId={createId} random={random}>
        <AppThemeRoot>
          <HostChromeProvider value={hostNav}>
            <Box sx={rootSx}>
              <ClientHost apps={apps} />
            </Box>
          </HostChromeProvider>
        </AppThemeRoot>
      </IdProvider>
    </ClockProvider>
  );
}

const rootSx = {
  flex: 1,
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  minHeight: 0,
} as const;
