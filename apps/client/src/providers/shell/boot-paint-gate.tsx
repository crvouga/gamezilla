/**
 * Blocks the product navigator until fonts, local SQLite, and Skia assets are
 * ready. Providers above this gate still mount so they can mark the latch.
 * The global action menu stays on a TopBar during the gate so chrome is never
 * absent once {@link AppFrameChromeProvider} is mounted.
 */

import { useLingui } from '@lingui/react/macro';
import {
  Box,
  LoadingState,
  TopBar,
  useAppFrameGlobalTrailing,
} from '@pkgs/ui-rn';
import type { ReactNode } from 'react';

import { useLocalPaintLatch } from './local-paint-latch';

export function BootPaintGate({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { bootReady } = useLocalPaintLatch();
  const { t } = useLingui();
  const globalTrailing = useAppFrameGlobalTrailing();

  if (!bootReady) {
    return (
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <TopBar trailing={globalTrailing} />
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'background',
          }}
        >
          <LoadingState size="large" caption={t`Downloading…`} />
        </Box>
      </Box>
    );
  }

  return <>{children}</>;
}
