// @io-wall-ok — Expo composition root for the product client.

import { createClient } from '@apps/client/product/create-client';
import { wallClientEnv } from '@apps/client/product/wall-client-env';
import { ClockProvider, wallClock, wallTimers } from '@pkgs/clock';
import { AppThemeRoot, Box } from '@pkgs/ui';
import { IdProvider } from '@pkgs/uuid';
import { type ReactNode, useEffect, useMemo } from 'react';

/** Expo root: product App only. */
export function RootApp(): ReactNode {
  const client = useMemo(() => createClient(wallClientEnv()), []);
  const createId = useMemo(() => () => crypto.randomUUID(), []);
  const random = useMemo(() => () => Math.random(), []);
  useEffect(() => {
    return () => {
      void client.close();
    };
  }, [client]);
  return (
    <ClockProvider clock={wallClock} timers={wallTimers}>
      <IdProvider createId={createId} random={random}>
        <AppThemeRoot>
          <Box sx={rootSx}>
            <client.App />
          </Box>
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
