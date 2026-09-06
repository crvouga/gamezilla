/** @jsxImportSource solid-js */
/**
 * Blocks the product navigator until fonts and local SQLite are ready.
 * Providers above this gate still mount so they can mark the latch. The
 * global action menu stays on a `TopBar` during the gate so chrome is never
 * absent once `AppFrameChromeProvider` is mounted.
 */

import { useLingui } from '@lingui/solid/macro';
import { Box, LoadingState, TopBar, useAppFrameGlobalTrailing } from '@pkgs/ui';
import { type JSX, Show } from 'solid-js';

import { useLocalPaintLatch } from './local-paint-latch';

function BootPaintGateFallback(): JSX.Element {
  const { t } = useLingui();
  const globalTrailing = useAppFrameGlobalTrailing();
  return (
    <Box
      sx={{ flex: 1, minHeight: 0 }}
      dataSet={{ component: 'BootPaintGate' }}
    >
      <TopBar trailing={globalTrailing()} />
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          alignItems: 'center',
          justifyContent: 'center',
          background: 'background',
        }}
      >
        <LoadingState size="large" caption={t`Downloading…`} />
      </Box>
    </Box>
  );
}

export function BootPaintGate(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  const latch = useLocalPaintLatch();
  return (
    <Show when={latch.bootReady()} fallback={<BootPaintGateFallback />}>
      {props.children}
    </Show>
  );
}
