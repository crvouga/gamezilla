import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useStackProps } from '@pkgs/ui';
import { Stack } from 'expo-router';
import type { ReactNode } from 'react';

/**
 * Nested stack for `/space/*`; native stack header stays hidden (use in-screen
 * header bars).
 *
 * Root presents this group as `fullScreenModal`, which sits above the app-root
 * {@link BottomSheetModalProvider} portal. A nested provider hosts sheets
 * (members, invite, rename, …) inside this native modal layer.
 */
export default function SpaceLayout(): ReactNode {
  const props = useStackProps();
  return (
    <BottomSheetModalProvider>
      <Stack {...props} />
    </BottomSheetModalProvider>
  );
}
