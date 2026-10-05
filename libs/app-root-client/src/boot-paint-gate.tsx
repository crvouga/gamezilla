/** @jsxImportSource solid-js */
/**
 * Blocks the product navigator until fonts are ready. Local SQLite may still
 * be opening underneath — providers above this gate still mount so they can
 * mark the latch. The global action menu stays on a `TopBar` during the gate.
 */

import { useAppFrameGlobalTrailing } from '@pkgs/ui-root-client/app-frame-chrome';
import { TopBar } from '@pkgs/ui-root-client/top-bar';
import { type JSX, Show } from 'solid-js';

import { BootLoadingShell } from './boot-loading-shell';
import { useLocalPaintLatch } from './local-paint-latch';

function BootPaintGateFallback(): JSX.Element {
  const globalTrailing = useAppFrameGlobalTrailing();
  return (
    <div class="box flex-1 min-h-0" data-component="BootPaintGate">
      <TopBar trailing={globalTrailing()} />
      <BootLoadingShell />
    </div>
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
