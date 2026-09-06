/**
 * iOS container for {@link BottomSheetModal}: native stack modal screens
 * (`presentation: 'fullScreenModal' | 'modal' | …`) sit above the root
 * portal host, so sheets must render through {@link FullWindowOverlay}.
 *
 * No-op on Android / web (pass `undefined` as `containerComponent`).
 */

import type { ComponentType, PropsWithChildren, ReactElement } from 'react';
import { Platform } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';

function IosBottomSheetModalContainer({
  children,
}: PropsWithChildren): ReactElement {
  return <FullWindowOverlay>{children}</FullWindowOverlay>;
}

/** Pass to `BottomSheetModal` `containerComponent` on iOS only. */
export const bottomSheetModalContainer:
  | ComponentType<PropsWithChildren>
  | undefined =
  Platform.OS === 'ios' ? IosBottomSheetModalContainer : undefined;
