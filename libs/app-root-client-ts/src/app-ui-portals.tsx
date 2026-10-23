/** @jsxImportSource solid-js */
/**
 * Overlay + surface-stack hosts for chrome that paints **outside** the SQLite
 * gate (`AppFrame` header, boot top bar). `FloatingMenu` / modals throw
 * without {@link SurfaceStackProvider}; those hosts used to live only inside
 * the sync ready tree, so opening the account menu crashed the product shell.
 *
 * Keep this module free of command-palette / mutation graphs so
 * `AppProvidersOuter` can import it on the entry chunk.
 */

import { OverlayPortalProvider } from '@pkgs/ui-root-client-ts/overlay-portal';
import { PendingNavigationConfirmation } from '@pkgs/ui-root-client-ts/pending-navigation-provider';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import type { JSX } from 'solid-js';

export function AppUiPortals(props: {
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <OverlayPortalProvider>
      <SurfaceStackProvider>
        {props.children}
        <PendingNavigationConfirmation />
      </SurfaceStackProvider>
    </OverlayPortalProvider>
  );
}
