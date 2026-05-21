import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import {
  DismissibleBannerPortalProvider,
  OverlayPortalProvider,
} from '@pkgs/ui';
import type { ReactNode } from 'react';

export function UiPortalsProvider({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  return (
    <OverlayPortalProvider>
      <DismissibleBannerPortalProvider>
        <BottomSheetModalProvider>{children}</BottomSheetModalProvider>
      </DismissibleBannerPortalProvider>
    </OverlayPortalProvider>
  );
}
