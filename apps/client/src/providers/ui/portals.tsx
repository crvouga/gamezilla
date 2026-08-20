import { useOptionalClientEnv } from '@apps/client/product/client-env-provider';
import {
  type BottomSheetHost,
  BottomSheetHostProvider,
  DismissibleBannerPortalProvider,
  OverlayPortalProvider,
  SurfaceStackProvider,
} from '@pkgs/ui';
import type { ReactNode } from 'react';

/**
 * {@link OverlayPortalProvider} must wrap {@link SurfaceStackProvider}: surface
 * chrome renders in the stack host (sibling of `children`), so it only keeps
 * OverlayPortal context when Overlay is outside. Otherwise modal tooltips
 * (e.g. CloseIconButton) silently no-op. Overlay host z-index stays above
 * surfaces; banners stay under overlay.
 *
 * Pass `host` when not under {@link ClientEnvProvider} (system console).
 * Product trees omit it and read `env.bottomSheetHost`.
 */
export function AppUiPortals({
  children,
  host: hostProp,
}: {
  children: ReactNode;
  host?: BottomSheetHost;
}): ReactNode {
  const env = useOptionalClientEnv();
  const host = hostProp ?? env?.bottomSheetHost;
  if (host === undefined) {
    throw new Error(
      'AppUiPortals: BottomSheetHost required — pass host or wrap with createClient'
    );
  }
  const { Provider: SheetProvider } = host;
  return (
    <BottomSheetHostProvider host={host}>
      <OverlayPortalProvider>
        <SurfaceStackProvider>
          <DismissibleBannerPortalProvider>
            <SheetProvider>{children}</SheetProvider>
          </DismissibleBannerPortalProvider>
        </SurfaceStackProvider>
      </OverlayPortalProvider>
    </BottomSheetHostProvider>
  );
}
