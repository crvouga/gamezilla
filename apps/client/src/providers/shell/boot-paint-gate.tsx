/**
 * Blocks the product navigator until fonts, local SQLite, and Skia assets are
 * ready. Providers above this gate still mount so they can mark the latch.
 */

import { useLingui } from '@lingui/react/macro';
import { Box, LoadingState } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { useLocalPaintLatch } from './local-paint-latch';

export function BootPaintGate({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { bootReady } = useLocalPaintLatch();
  const { t } = useLingui();

  if (!bootReady) {
    return (
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
    );
  }

  return <>{children}</>;
}
