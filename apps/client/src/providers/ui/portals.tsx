import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import {
  DismissibleBannerPortalProvider,
  OverlayPortalProvider,
  SurfaceStackProvider,
} from '@pkgs/ui';
import type { ReactNode } from 'react';

export function AppUiPortals({ children }: { children: ReactNode }): ReactNode {
  return (
    <SurfaceStackProvider>
      <OverlayPortalProvider>
        <DismissibleBannerPortalProvider>
          <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
        </DismissibleBannerPortalProvider>
      </OverlayPortalProvider>
    </SurfaceStackProvider>
  );
}
