import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import {
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
 */
export function AppUiPortals({ children }: { children: ReactNode }): ReactNode {
  return (
    <OverlayPortalProvider>
      <SurfaceStackProvider>
        <DismissibleBannerPortalProvider>
          <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
        </DismissibleBannerPortalProvider>
      </SurfaceStackProvider>
    </OverlayPortalProvider>
  );
}
